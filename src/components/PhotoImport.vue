<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { X } from 'lucide-vue-next';
  import MarkCircle from '@/components/MarkCircle.vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals, useModalEntry } from '@/composables/useModals';
  import Sheet from '@/components/Sheet.vue';
  import { loadPhoto, scanSheet, matchScannedTasks, ScanError } from '@/utils/sheetScan';

  const props = defineProps({
    /** Фото бланка */
    file: { type: Object, required: true },
  });

  const store = useHabitStore();
  const { t } = useI18n();
  const { monthKeyLabel } = useHabitUtils();
  const { toastWithUndo } = useModals(t);
  const { close } = useModalEntry();

  /** Этап: 'scanning' | 'error' | 'review' */
  const status = ref('scanning');
  const errorText = ref('');
  /** Номер страницы бланка и число страниц */
  const sheetPage = ref(null);
  /** Распознанные задачи: [{ task, rows: [[{ value, uncertain }]] }] */
  const entries = ref([]);
  /** Число задач с бланка, которых нет в месяце */
  const missing = ref(0);

  const dayIndexes = computed(() => Array.from({ length: store.daysInMonth }, (_, i) => i));

  const showError = text => {
    errorText.value = text;
    status.value = 'error';
  };

  onMounted(async () => {
    let photo = null;
    try {
      photo = await loadPhoto(props.file);
      const scan = await scanSheet(photo.image, photo.readRegion);
      if (scan.month !== store.currentMonthKey) {
        showError(t('scan.error.month', { month: monthKeyLabel(scan.month) }));
        return;
      }
      const result = matchScannedTasks(scan, store.tasks);
      if (result.matched.length === 0) {
        showError(t('scan.error.noTasks'));
        return;
      }
      entries.value = result.matched;
      missing.value = result.missing;
      sheetPage.value = { page: scan.page, pages: scan.pages };
      status.value = 'review';
    } catch (error) {
      if (!(error instanceof ScanError)) console.error(error);
      showError(t(`scan.error.${error instanceof ScanError ? error.code : 'failed'}`));
    } finally {
      photo?.close();
    }
  });

  /** Отметку можно перенести только за прошедшие дни и сегодня */
  const isEditable = dayIndex => dayIndex < store.today;

  const isChanged = (entry, row, dayIndex) =>
    isEditable(dayIndex) &&
    entry.rows[row][dayIndex].value !== entry.task.subtasks[row].marks[dayIndex];

  const changedCount = computed(() =>
    entries.value.reduce(
      (sum, entry) =>
        sum +
        entry.rows.reduce(
          (rowSum, cells, row) =>
            rowSum + cells.filter((_, dayIndex) => isChanged(entry, row, dayIndex)).length,
          0
        ),
      0
    )
  );

  const uncertainCount = computed(
    () =>
      entries.value.flatMap(entry =>
        entry.rows.flatMap(cells => cells.filter((cell, i) => cell.uncertain && isEditable(i)))
      ).length
  );

  /** Нажатие по кружку: выполнено → пропуск → не выполнено → выполнено */
  const cycleCell = cell => {
    cell.value = cell.value === true ? false : cell.value === false ? null : true;
    cell.uncertain = false;
  };

  /** Рамка кружка: сплошная – отличается от текущих данных, пунктирная – стоит проверить */
  const cellClass = (entry, row, dayIndex) => {
    const cell = entry.rows[row][dayIndex];
    return {
      'ring-accent ring-2': isChanged(entry, row, dayIndex),
      'outline-warn outline-2 outline-offset-2 outline-dashed':
        cell.uncertain && isEditable(dayIndex),
    };
  };

  const markStateKey = mark => {
    if (mark === true) return 'mark.done';
    if (mark === false) return 'mark.skip';
    return 'mark.notDone';
  };

  const apply = () => {
    store.applyScannedMarks(
      entries.value.map(entry => ({
        taskId: entry.task.id,
        rows: entry.rows.map(cells => cells.map(cell => cell.value)),
      }))
    );
    close();
    toastWithUndo(t('scan.applied'));
  };
</script>

<template>
  <Sheet full :label="t('scan.title')" @close="close">
    <div class="mx-auto flex max-w-[1100px] flex-col gap-4 p-4 select-none md:p-8">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-[22px] font-bold tracking-tight">
          {{ t('scan.title') }}
          <span v-if="sheetPage && sheetPage.pages > 1" class="text-muted">
            {{ sheetPage.page }}/{{ sheetPage.pages }}
          </span>
        </h2>
        <button
          class="bg-soft flex size-10 items-center justify-center rounded-full"
          :aria-label="t('common.close')"
          @click="close"
        >
          <X class="size-5" />
        </button>
      </div>

      <p v-if="status === 'scanning'" class="text-muted">{{ t('scan.scanning') }}</p>

      <p v-else-if="status === 'error'" class="bg-soft rounded-[14px] p-4 leading-normal">
        {{ errorText }}
      </p>

      <template v-else>
        <div class="text-muted flex flex-col gap-1 text-sm leading-normal">
          <p class="text-ink font-semibold">
            {{ t('scan.summary', { changed: changedCount, uncertain: uncertainCount }) }}
          </p>
          <p>{{ t('scan.legend') }}</p>
          <p v-if="missing > 0" class="text-warn">
            {{ t('scan.missing', { count: missing }, missing) }}
          </p>
        </div>

        <!-- Распознанные задачи -->
        <div class="border-line overflow-x-auto rounded-[14px] border">
          <div
            v-for="entry in entries"
            :key="entry.task.id"
            class="border-line flex w-fit min-w-full flex-col gap-2 border-t px-4 pt-3 pb-3.5 first:border-t-0"
          >
            <p class="text-sm font-medium">{{ entry.task.title }}</p>
            <div class="flex gap-0.5">
              <div
                v-for="dayIndex in dayIndexes"
                :key="dayIndex"
                class="flex w-6 flex-col items-center gap-1"
              >
                <span class="text-muted text-[10px]">{{ dayIndex + 1 }}</span>
                <button
                  v-for="(cells, row) in entry.rows"
                  :key="row"
                  type="button"
                  class="flex size-6 items-center justify-center disabled:cursor-default"
                  :disabled="!isEditable(dayIndex)"
                  :aria-label="
                    t('mark.cell', {
                      title: entry.task.title,
                      day: dayIndex + 1,
                      subtask: row + 1,
                      state: t(markStateKey(cells[dayIndex].value)),
                    })
                  "
                  @click="cycleCell(cells[dayIndex])"
                >
                  <MarkCircle
                    class="rounded-full"
                    :class="cellClass(entry, row, dayIndex)"
                    :mark="cells[dayIndex].value"
                    :future="!isEditable(dayIndex)"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button
            class="border-line hover:bg-soft h-11 rounded-xl border px-4 text-sm"
            @click="close"
          >
            {{ t('common.cancel') }}
          </button>
          <button class="bg-ink text-bg h-11 rounded-xl px-5 text-sm font-semibold" @click="apply">
            {{ t('scan.apply') }}
          </button>
        </div>
      </template>
    </div>
  </Sheet>
</template>
