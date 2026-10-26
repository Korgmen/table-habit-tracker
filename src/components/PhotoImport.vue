<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { X } from 'lucide-vue-next';
  import { useHabitStore } from '@/stores/habitStore';
  import { loadPhoto, scanSheet, matchScannedTasks, ScanError } from '@/utils/sheetScan';

  const props = defineProps({
    /** Фото бланка */
    file: Object,
    /** Текущая тема (light/dark) */
    currentTheme: String,
  });

  const emit = defineEmits([
    /** Закрытие окна */
    'close',
  ]);

  const store = useHabitStore();
  const { t, locale } = useI18n();

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

  /** Название месяца 'YYYY-MM' на языке интерфейса */
  const formatMonth = key => {
    const [year, month] = key.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString(locale.value, {
      month: 'long',
      year: 'numeric',
    });
  };

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
        showError(t('scan.error.month', { month: formatMonth(scan.month) }));
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

  const cellClass = (entry, row, dayIndex) => {
    const cell = entry.rows[row][dayIndex];
    return {
      'bg-current': cell.value === true,
      'before:opacity-100 after:opacity-100': cell.value === false,
      'text-blue-500': isChanged(entry, row, dayIndex),
      'outline-2 outline-offset-2 outline-amber-500': cell.uncertain && isEditable(dayIndex),
      'cursor-pointer': isEditable(dayIndex),
      'cursor-not-allowed opacity-30': !isEditable(dayIndex),
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
    emit('close');
  };
</script>

<template>
  <div
    class="fixed inset-0 z-50 overflow-y-auto p-4 select-none md:p-8"
    :class="currentTheme === 'dark' ? 'bg-[#292929] text-[#FFF8F0]' : 'bg-white text-[#12130F]'"
    role="dialog"
    aria-modal="true"
    :aria-label="t('scan.title')"
  >
    <div class="mx-auto flex max-w-[960px] flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-xl font-semibold">
          {{ t('scan.title') }}
          <span v-if="sheetPage && sheetPage.pages > 1">
            {{ sheetPage.page }}/{{ sheetPage.pages }}
          </span>
        </h2>
        <button
          class="tap-highlight-transparent cursor-pointer touch-manipulation p-2"
          :aria-label="t('settings.close')"
          @click="emit('close')"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <p v-if="status === 'scanning'">{{ t('scan.scanning') }}</p>

      <p v-else-if="status === 'error'">{{ errorText }}</p>

      <template v-else>
        <div class="flex flex-col gap-1 text-sm">
          <p>{{ t('scan.summary', { changed: changedCount, uncertain: uncertainCount }) }}</p>
          <p>{{ t('scan.legend') }}</p>
          <p v-if="missing > 0" class="text-amber-500">
            {{ t('scan.missing', { count: missing }) }}
          </p>
        </div>

        <!-- Распознанные задачи -->
        <div class="overflow-x-auto border-3">
          <div
            v-for="entry in entries"
            :key="entry.task.id"
            class="flex w-fit min-w-full flex-col items-center gap-2 border-t-3 px-3 pt-2.5 pb-3 first:border-t-0"
          >
            <p class="font-bold">{{ entry.task.title }}</p>
            <div class="flex gap-1">
              <div
                v-for="dayIndex in dayIndexes"
                :key="dayIndex"
                class="flex w-4 flex-col items-center gap-[5px]"
              >
                <span class="text-[10px] leading-none font-medium">{{ dayIndex + 1 }}</span>
                <button
                  v-for="(cells, row) in entry.rows"
                  :key="row"
                  type="button"
                  class="tap-highlight-transparent relative flex aspect-square w-3 touch-manipulation items-center justify-center rounded-[50%] border-2 border-current before:absolute before:h-0.5 before:w-full before:rotate-45 before:bg-current before:opacity-0 after:absolute after:h-0.5 after:w-full after:-rotate-45 after:bg-current after:opacity-0"
                  :class="cellClass(entry, row, dayIndex)"
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
                ></button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button
            class="tap-highlight-transparent flex h-8 cursor-pointer touch-manipulation items-center border-2 px-3 font-semibold"
            @click="emit('close')"
          >
            {{ t('modal.cancel') }}
          </button>
          <button
            class="tap-highlight-transparent flex h-8 cursor-pointer touch-manipulation items-center border-2 px-3 font-semibold"
            @click="apply"
          >
            {{ t('scan.apply') }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
