<script setup>
  import { ref, computed, watch } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { MAX_TASKS, MAX_SUBTASKS, MAX_TITLE, MAX_GOAL, HABIT_COLORS } from '@/utils/archive';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { resolveLang } from '@/i18n';
  import { X, Minus, Plus, ArrowUp, ArrowDown, Ban, NotebookPen, Smile } from 'lucide-vue-next';
  import Sheet from '@/components/Sheet.vue';
  import MarkCircle from '@/components/MarkCircle.vue';
  import EmojiPicker from '@/components/EmojiPicker.vue';

  const props = defineProps({
    /** ID привычки для правки; без него окно создаёт новую */
    taskId: { type: [Number, String], default: null },
    /** Число, для которого предлагается заметка (выбранный день на телефоне); иначе сегодня */
    focusDay: { type: Number, default: null },
  });

  const store = useHabitStore();
  const modalStore = useModalStore();
  const {
    isDesktop,
    monthDays,
    isFuture,
    todayDay,
    weekHeaders,
    weekdayName,
    weekOrder,
    leadingBlanks,
    currentMonthLabel,
  } = useHabitUtils();
  const { t } = useI18n();
  const { deleteHabit, toastWithUndo, openNote } = useModals(t);

  const task = computed(() => store.tasks.find(item => item.id === props.taskId) || null);
  const isNew = props.taskId === null;

  const draftTitle = ref(task.value?.title || '');
  const draftSubs = ref(task.value?.subtasks.length || 1);
  const draftEmoji = ref(task.value?.emoji || '');
  const emojiOpen = ref(false);
  const pickEmoji = emoji => {
    draftEmoji.value = emoji;
    emojiOpen.value = false;
  };
  const draftColor = ref(task.value?.color || null);
  /** 'daily' – каждый день, 'days' – по дням недели, 'goal' – N раз в неделю */
  const scheduleMode = ref(task.value?.goal ? 'goal' : task.value?.schedule ? 'days' : 'daily');
  const draftDays = ref(new Set(task.value?.schedule || [1, 2, 3, 4, 5]));
  const draftGoal = ref(task.value?.goal || 3);
  const draftPaused = ref(!!task.value?.paused);
  const activeSub = ref(0);
  const confirmDelete = ref(false);

  /** Поля привычки из черновика; undefined убирает поле */
  const draftFields = computed(() => ({
    emoji: draftEmoji.value.trim() || undefined,
    color: draftColor.value || undefined,
    schedule:
      scheduleMode.value === 'days' && draftDays.value.size > 0
        ? [...draftDays.value].sort()
        : undefined,
    goal: scheduleMode.value === 'goal' ? draftGoal.value : undefined,
    paused: draftPaused.value || undefined,
  }));

  const toggleDay = weekday => {
    const next = new Set(draftDays.value);
    if (next.has(weekday)) next.delete(weekday);
    else next.add(weekday);
    draftDays.value = next;
  };

  const scheduleOptions = computed(() => [
    ['daily', t('habit.scheduleDaily')],
    ['days', t('habit.scheduleDays')],
    ['goal', t('habit.scheduleGoal')],
  ]);

  const segmentClass = active =>
    active ? 'bg-surface font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'hover:bg-surface/50';

  /** Заметки месяца по порядку дней: { day, text } */
  const notes = computed(() =>
    Object.entries(task.value?.notes || {})
      .map(([index, text]) => ({ day: Number(index) + 1, text }))
      .sort((a, b) => a.day - b.day)
  );

  /** День для новой заметки: переданный из ленты или сегодня (последний день архивного месяца) */
  const noteDay = computed(() => Math.min(props.focusDay || store.today, store.today));

  const dayLabel = day =>
    new Date(store.currentYear, store.currentMonth, day).toLocaleDateString(
      resolveLang(store.lang),
      { day: 'numeric', month: 'short' }
    );

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

  /** Применяет черновик к существующей привычке */
  const applyDraft = () => {
    const removesMarks = draftSubs.value < task.value.subtasks.length;
    store.updateTask(props.taskId, draftTitle.value, draftSubs.value, draftFields.value);
    if (removesMarks) toastWithUndo(t('habit.subsRemoved'));
  };

  const save = () => {
    if (!canSave.value) return;
    if (isNew) {
      if (!store.addTask(draftTitle.value, draftSubs.value, draftFields.value)) {
        modalStore.showToast(t('taskLimit', { max: MAX_TASKS }));
        return;
      }
      modalStore.showToast(t('habit.added', { title: draftTitle.value.trim() }));
    } else {
      applyDraft();
    }
    close();
  };

  /** Заметка открывается вместо окна привычки: правки окна сначала сохраняются */
  const editNote = day => {
    if (canSave.value) applyDraft();
    openNote(props.taskId, day, true);
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
        <div class="flex gap-2">
          <div class="flex w-16 shrink-0 flex-col gap-1.5">
            <span class="text-muted text-[13px]">{{ t('habit.emoji') }}</span>
            <button
              type="button"
              class="border-line2 bg-bg hover:border-ink flex h-12 items-center justify-center rounded-xl border-[1.5px] text-xl"
              :class="emojiOpen ? 'border-ink' : ''"
              :aria-label="t('habit.emojiPick')"
              :aria-expanded="emojiOpen"
              @click="emojiOpen = !emojiOpen"
            >
              <template v-if="draftEmoji">{{ draftEmoji }}</template>
              <Smile v-else class="text-muted size-5" />
            </button>
          </div>
          <label class="flex min-w-0 flex-1 flex-col gap-1.5">
            <span class="text-muted text-[13px]">{{ t('habit.name') }}</span>
            <input
              v-model="draftTitle"
              :autofocus="isNew"
              :placeholder="t('habit.namePlaceholder')"
              :maxlength="MAX_TITLE"
              class="border-line2 bg-bg focus:border-ink h-12 rounded-xl border-[1.5px] px-3.5 text-base outline-none"
            />
          </label>
        </div>

        <EmojiPicker
          v-if="emojiOpen"
          class="-mt-2"
          :model-value="draftEmoji"
          :title="draftTitle"
          @pick="pickEmoji"
        />

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">{{ t('habit.color') }}</span>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" :aria-label="t('habit.color')">
            <button
              type="button"
              role="radio"
              :aria-checked="draftColor === null"
              :aria-label="t('habit.colorNone')"
              class="border-line2 text-muted flex size-9 items-center justify-center rounded-full border"
              :class="
                draftColor === null ? 'ring-ink ring-2 ring-offset-2 ring-offset-(--surface)' : ''
              "
              @click="draftColor = null"
            >
              <Ban class="size-4" />
            </button>
            <button
              v-for="color in HABIT_COLORS"
              :key="color"
              type="button"
              role="radio"
              :aria-checked="draftColor === color"
              :aria-label="t(`habit.colors.${color}`)"
              class="size-9 rounded-full bg-(--habit)"
              :class="
                draftColor === color ? 'ring-ink ring-2 ring-offset-2 ring-offset-(--surface)' : ''
              "
              :style="{ '--habit': `var(--habit-${color})` }"
              @click="draftColor = color"
            ></button>
          </div>
        </div>

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

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">{{ t('habit.schedule') }}</span>
          <div
            class="bg-soft grid grid-cols-3 gap-1 rounded-xl p-1"
            role="radiogroup"
            :aria-label="t('habit.schedule')"
          >
            <button
              v-for="[value, label] in scheduleOptions"
              :key="value"
              type="button"
              role="radio"
              :aria-checked="scheduleMode === value"
              class="h-[38px] rounded-[9px] px-1 text-[13px]"
              :class="segmentClass(scheduleMode === value)"
              @click="scheduleMode = value"
            >
              {{ label }}
            </button>
          </div>
          <div v-if="scheduleMode === 'days'" class="grid grid-cols-7 gap-1">
            <button
              v-for="weekday in weekOrder"
              :key="weekday"
              type="button"
              :aria-pressed="draftDays.has(weekday)"
              class="h-9 rounded-[10px] border text-[13px]"
              :class="draftDays.has(weekday) ? 'border-ink bg-ink text-bg' : 'border-line2'"
              @click="toggleDay(weekday)"
            >
              {{ weekdayName(weekday) }}
            </button>
          </div>
          <div v-if="scheduleMode === 'goal'" class="flex items-center justify-between gap-4">
            <span class="text-sm">{{ t('habit.goalCount', { count: draftGoal }) }}</span>
            <div class="border-line2 flex shrink-0 items-center rounded-xl border">
              <button
                type="button"
                class="disabled:text-line2 flex size-11 items-center justify-center"
                :disabled="draftGoal <= 1"
                :aria-label="t('habit.decrease')"
                @click="draftGoal--"
              >
                <Minus class="size-5" />
              </button>
              <span class="min-w-7 text-center text-[17px] font-bold">{{ draftGoal }}</span>
              <button
                type="button"
                class="disabled:text-line2 flex size-11 items-center justify-center"
                :disabled="draftGoal >= MAX_GOAL"
                :aria-label="t('habit.increase')"
                @click="draftGoal++"
              >
                <Plus class="size-5" />
              </button>
            </div>
          </div>
          <span v-if="scheduleMode !== 'daily'" class="text-muted text-xs leading-snug">
            {{ scheduleMode === 'days' ? t('habit.scheduleHint') : t('habit.goalHint') }}
          </span>
        </div>

        <label class="flex items-center justify-between gap-4">
          <span class="flex flex-col gap-0.5">
            <span class="text-sm font-medium">{{ t('habit.paused') }}</span>
            <span class="text-muted text-xs leading-snug">{{ t('habit.pausedHint') }}</span>
          </span>
          <input
            v-model="draftPaused"
            type="checkbox"
            role="switch"
            class="accent-ink size-5 shrink-0"
          />
        </label>

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
                  :color="task.color"
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

          <div class="flex flex-col gap-2">
            <span class="text-sm font-medium">
              {{ t('habit.notes', { month: currentMonthLabel }) }}
            </span>
            <button
              v-for="note in notes"
              :key="note.day"
              type="button"
              class="bg-soft hover:bg-line flex items-baseline gap-2.5 rounded-xl px-3 py-2.5 text-start"
              @click="editNote(note.day)"
            >
              <span class="text-muted shrink-0 text-xs">{{ dayLabel(note.day) }}</span>
              <span class="line-clamp-2 min-w-0 text-sm break-words">{{ note.text }}</span>
            </button>
            <button
              v-if="!notes.some(note => note.day === noteDay)"
              type="button"
              class="border-line2 hover:bg-soft flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-dashed text-sm"
              @click="editNote(noteDay)"
            >
              <NotebookPen class="size-4" />
              {{ t('habit.addNote', { date: dayLabel(noteDay) }) }}
            </button>
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
