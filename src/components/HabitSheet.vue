<script setup>
  import { ref, computed, watch } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { MAX_TASKS, MAX_SUBTASKS, MAX_TITLE } from '@/utils/archive';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { X, Minus, Plus, ArrowUp, ArrowDown } from 'lucide-vue-next';
  import Sheet from '@/components/Sheet.vue';
  import MarkCircle from '@/components/MarkCircle.vue';

  const props = defineProps({
    /** ID привычки для правки; без него окно создаёт новую */
    taskId: { type: [Number, String], default: null },
  });

  const store = useHabitStore();
  const modalStore = useModalStore();
  const {
    isDesktop,
    monthDays,
    isFuture,
    todayDay,
    weekHeaders,
    leadingBlanks,
    currentMonthLabel,
  } = useHabitUtils();
  const { t } = useI18n();
  const { deleteHabit, toastWithUndo } = useModals(t);

  const task = computed(() => store.tasks.find(item => item.id === props.taskId) || null);
  const isNew = props.taskId === null;

  const draftTitle = ref(task.value?.title || '');
  const draftSubs = ref(task.value?.subtasks.length || 1);
  const activeSub = ref(0);
  const confirmDelete = ref(false);

  /** Привычку удалили или сменился месяц: окно правки больше не к чему привязать */
  watch(task, value => {
    if (!isNew && !value) modalStore.closeModal();
  });

  const canSave = computed(() => draftTitle.value.trim().length > 0);
  const subtask = computed(
    () => task.value?.subtasks[Math.min(activeSub.value, task.value.subtasks.length - 1)]
  );

  /** Выполнено и пропусков по учитываемым дням (как в прогрессе) */
  const stats = computed(() => {
    const maxDay = store.calculationMode === 'fullMonth' ? store.daysInMonth : store.today;
    let done = 0;
    let skips = 0;
    task.value?.subtasks.forEach(item => {
      for (let i = 0; i < maxDay; i++) {
        if (item.marks[i] === true) done++;
        else if (item.marks[i] === false) skips++;
      }
    });
    return { done, skips };
  });

  const position = computed(() => store.tasks.findIndex(item => item.id === props.taskId));

  const close = () => modalStore.closeModal();

  const save = () => {
    if (!canSave.value) return;
    if (isNew) {
      if (!store.addTask(draftTitle.value, draftSubs.value)) {
        modalStore.showToast(t('taskLimit', { max: MAX_TASKS }));
        return;
      }
      modalStore.showToast(t('habit.added', { title: draftTitle.value.trim() }));
    } else {
      const removesMarks = draftSubs.value < task.value.subtasks.length;
      store.updateTask(props.taskId, draftTitle.value, draftSubs.value);
      if (removesMarks) toastWithUndo(t('habit.subsRemoved'));
    }
    close();
  };

  const remove = () => {
    close();
    deleteHabit(props.taskId);
  };
</script>

<template>
  <Sheet :label="isNew ? t('habit.titleNew') : t('habit.title')" @close="close">
    <form class="flex flex-col" @submit.prevent="save">
      <div class="flex items-center justify-between gap-3 px-6 pt-5 pb-2">
        <span class="text-[22px] font-bold tracking-tight">
          {{ isNew ? t('habit.titleNew') : t('habit.title') }}
        </span>
        <button
          type="button"
          class="bg-soft flex size-10 items-center justify-center rounded-full"
          :aria-label="t('common.close')"
          @click="close"
        >
          <X class="size-5" />
        </button>
      </div>

      <div class="flex flex-col gap-5 px-6 pt-2 pb-6">
        <label class="flex flex-col gap-1.5">
          <span class="text-muted text-[13px]">{{ t('habit.name') }}</span>
          <input
            v-model="draftTitle"
            :autofocus="isNew"
            :placeholder="t('habit.namePlaceholder')"
            :maxlength="MAX_TITLE"
            class="border-line2 bg-bg focus:border-ink h-12 rounded-xl border-[1.5px] px-3.5 text-base outline-none"
          />
        </label>

        <div class="flex items-center justify-between gap-4">
          <span class="flex flex-col gap-0.5">
            <span class="text-sm font-medium">{{ t('habit.perDay') }}</span>
            <span class="text-muted text-xs leading-snug">
              {{ t('habit.perDayHint', { max: MAX_SUBTASKS }) }}
            </span>
          </span>
          <div class="border-line2 flex shrink-0 items-center rounded-xl border">
            <button
              type="button"
              class="disabled:text-line2 flex size-11 items-center justify-center"
              :disabled="draftSubs <= 1"
              :aria-label="t('habit.decrease')"
              @click="draftSubs--"
            >
              <Minus class="size-5" />
            </button>
            <span class="min-w-7 text-center text-[17px] font-bold">{{ draftSubs }}</span>
            <button
              type="button"
              class="disabled:text-line2 flex size-11 items-center justify-center"
              :disabled="draftSubs >= MAX_SUBTASKS"
              :aria-label="t('habit.increase')"
              @click="draftSubs++"
            >
              <Plus class="size-5" />
            </button>
          </div>
        </div>
        <span
          v-if="task && draftSubs < task.subtasks.length"
          class="text-danger -mt-3 text-xs leading-snug"
        >
          {{ t('habit.subsWarning') }}
        </span>

        <template v-if="task">
          <!-- Телефон: календарь отметок за месяц -->
          <div v-if="!isDesktop" class="flex flex-col gap-2.5">
            <div class="flex items-baseline justify-between">
              <span class="text-sm font-medium">
                {{ t('habit.marksFor', { month: currentMonthLabel }) }}
              </span>
              <span class="text-muted text-[13px]">{{ task.progress }}%</span>
            </div>
            <div
              v-if="task.subtasks.length > 1"
              class="flex gap-1 overflow-x-auto [scrollbar-width:none]"
            >
              <button
                v-for="(item, subIndex) in task.subtasks"
                :key="item.id"
                type="button"
                class="h-8 shrink-0 rounded-full border px-3 text-[13px]"
                :class="
                  subIndex === activeSub ? 'border-ink bg-ink text-bg' : 'border-line2 text-ink'
                "
                @click="activeSub = subIndex"
              >
                {{ t('habit.subTab', { n: subIndex + 1 }) }}
              </button>
            </div>
            <div class="grid grid-cols-7 gap-0.5">
              <span
                v-for="(header, headerIndex) in weekHeaders"
                :key="headerIndex"
                class="text-muted pb-0.5 text-center text-[11px]"
              >
                {{ header }}
              </span>
              <span v-for="blank in leadingBlanks" :key="`b${blank}`"></span>
              <button
                v-for="day in monthDays"
                :key="day"
                type="button"
                class="flex h-11 items-center justify-center disabled:cursor-default"
                :disabled="isFuture(day)"
                @click="store.cycleMark(task.id, subtask.id, day - 1)"
              >
                <MarkCircle
                  :mark="subtask.marks[day - 1]"
                  size="lg"
                  :label="day"
                  :today="day === todayDay"
                  :future="isFuture(day)"
                />
              </button>
            </div>
          </div>

          <!-- Десктоп: сводка за месяц -->
          <div v-else class="grid grid-cols-3 gap-2">
            <div class="bg-soft flex flex-col gap-0.5 rounded-xl p-3">
              <span class="text-muted text-xs">
                {{ t('habit.statMonth', { month: currentMonthLabel }) }}
              </span>
              <span class="text-lg font-bold">{{ task.progress }}%</span>
            </div>
            <div class="bg-soft flex flex-col gap-0.5 rounded-xl p-3">
              <span class="text-muted text-xs">{{ t('habit.statDone') }}</span>
              <span class="text-lg font-bold">{{ stats.done }}</span>
            </div>
            <div class="bg-soft flex flex-col gap-0.5 rounded-xl p-3">
              <span class="text-muted text-xs">{{ t('habit.statSkips') }}</span>
              <span class="text-lg font-bold">{{ stats.skips }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-medium">{{ t('habit.order') }}</span>
            <div class="flex gap-1.5">
              <button
                type="button"
                class="border-line disabled:text-line2 flex h-10 items-center gap-1 rounded-[10px] border px-3.5 text-sm"
                :disabled="position <= 0"
                @click="store.moveTask(task.id, -1)"
              >
                <ArrowUp class="size-4" />
                {{ t('habit.up') }}
              </button>
              <button
                type="button"
                class="border-line disabled:text-line2 flex h-10 items-center gap-1 rounded-[10px] border px-3.5 text-sm"
                :disabled="position >= store.tasks.length - 1"
                @click="store.moveTask(task.id, 1)"
              >
                <ArrowDown class="size-4" />
                {{ t('habit.down') }}
              </button>
            </div>
          </div>

          <div
            v-if="confirmDelete"
            class="border-danger flex flex-col gap-3 rounded-[14px] border-[1.5px] p-3.5"
          >
            <span class="text-sm leading-normal">
              {{ t('habit.deleteConfirm', { title: task.title, month: currentMonthLabel }) }}
            </span>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="border-line h-10 rounded-[10px] border px-3.5 text-sm"
                @click="confirmDelete = false"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="button"
                class="bg-danger h-10 rounded-[10px] px-3.5 text-sm font-semibold text-white"
                @click="remove"
              >
                {{ t('common.delete') }}
              </button>
            </div>
          </div>
        </template>

        <span v-if="isNew" class="text-muted text-[13px]">
          {{ t('habit.limitLine', { count: store.tasks.length, max: MAX_TASKS }) }}
        </span>
      </div>

      <div
        class="border-line bg-surface sticky bottom-0 flex items-center gap-2 border-t px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)]"
      >
        <button
          v-if="task && !confirmDelete"
          type="button"
          class="text-danger h-11 px-1 text-sm font-semibold"
          @click="confirmDelete = true"
        >
          {{ t('common.delete') }}
        </button>
        <div class="flex-1"></div>
        <button
          type="button"
          class="border-line hover:bg-soft h-11 rounded-xl border px-4 text-sm"
          @click="close"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="submit"
          class="bg-ink text-bg h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-40"
          :disabled="!canSave"
        >
          {{ isNew ? t('common.add') : t('common.save') }}
        </button>
      </div>
    </form>
  </Sheet>
</template>
