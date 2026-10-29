<script setup>
  import { VueDraggableNext } from 'vue-draggable-next';
  import { useHabitStore } from '@/stores/habitStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { GripVertical, Plus } from 'lucide-vue-next';
  import MarkCircle from '@/components/MarkCircle.vue';

  const store = useHabitStore();
  const {
    monthDays,
    isWeekStart,
    isWeekend,
    isFuture,
    todayDay,
    weekdayLabel,
    habitColorStyle,
    weekdayName,
    weekOrder,
  } = useHabitUtils();
  const { t } = useI18n();
  const { openNewHabit, openHabit, openNote, toastWithUndo } = useModals(t);

  /** Клик по отметке меняет её, Alt+клик открывает заметку к дню */
  const clickMark = (event, task, subtask, day) => {
    if (isFuture(day)) return;
    if (event.altKey) openNote(task.id, day);
    else store.cycleMark(task.id, subtask.id, day - 1);
  };

  /** Вторая строка под названием: пауза, отметок в день, расписание или цель */
  const habitMeta = task => {
    const parts = [];
    if (task.paused) parts.push(t('grid.paused'));
    if (task.subtasks.length > 1) parts.push(t('grid.perDay', { count: task.subtasks.length }));
    if (task.schedule) {
      parts.push(
        weekOrder.value
          .filter(weekday => task.schedule.includes(weekday))
          .map(weekdayName)
          .join(', ')
      );
    }
    if (task.goal) parts.push(t('habit.goalCount', { count: task.goal }));
    return parts.join(' · ');
  };

  /** Отметка всего дня меняет много клеток сразу: тост предлагает отменить */
  const markDay = (day, state) => {
    if (isFuture(day)) return;
    const before = store.lastChangeId;
    store.toggleDay(day - 1, state);
    if (store.lastChangeId !== before) toastWithUndo(t('history.dayChanged', { day }));
  };

  /** Колонка дня: разделитель недели и подсветка сегодняшнего дня */
  const columnClass = day => [
    store.showWeekSeparators && isWeekStart(day) ? 'border-line' : 'border-transparent',
    day === todayDay.value ? 'bg-accent/9' : '',
  ];

  /** Номер дня в шапке */
  const dayNumberClass = day => {
    if (day === todayDay.value) return 'bg-accent text-white';
    if (isFuture(day)) return 'text-line2';
    if (isWeekend(day)) return 'text-muted';
    return 'text-ink';
  };

  /** Состояние отметки для озвучки */
  const markState = mark =>
    t(mark === true ? 'mark.done' : mark === false ? 'mark.skip' : 'mark.notDone');
</script>

<template>
  <div class="border-line relative flex-1 overflow-auto border-t print:overflow-visible">
    <div class="inline-flex min-w-full flex-col pb-4 select-none">
      <!-- Шапка: дни месяца -->
      <div class="border-line bg-bg sticky top-0 z-[3] flex border-b">
        <div
          class="border-line bg-bg text-muted sticky start-0 z-[4] flex w-[220px] shrink-0 items-end border-e ps-4 pb-2.5 text-xs"
        >
          {{ t('grid.habit') }}
        </div>
        <button
          v-for="day in monthDays"
          :key="day"
          class="enabled:hover:bg-soft flex w-7 shrink-0 flex-col items-center gap-[3px] border-s pt-2 pb-1.5"
          :class="columnClass(day)"
          :disabled="isFuture(day) || store.tasks.length === 0"
          :title="isFuture(day) ? undefined : t('grid.dayHint')"
          :aria-label="t('mark.headerDay', { day })"
          @click="markDay(day, true)"
          @contextmenu.prevent="markDay(day, false)"
        >
          <span class="text-muted text-[10px]">{{ weekdayLabel(day) }}</span>
          <span
            class="flex size-6 items-center justify-center rounded-full text-xs font-semibold"
            :class="dayNumberClass(day)"
          >
            {{ day }}
          </span>
        </button>
        <div class="text-muted flex w-[110px] shrink-0 items-end px-4 pb-2.5 text-xs">
          {{ t('grid.month') }}
        </div>
      </div>

      <!-- Строки привычек -->
      <VueDraggableNext
        :model-value="store.tasks"
        item-key="id"
        handle=".drag-handle"
        ghost-class="opacity-40"
        @update:model-value="store.reorderTasks"
      >
        <div v-for="task in store.tasks" :key="task.id" class="border-line flex border-b">
          <div
            class="border-line bg-bg sticky start-0 z-[2] flex w-[220px] shrink-0 items-center gap-1.5 border-e ps-2 pe-1.5"
          >
            <span
              class="drag-handle hide-print text-line2 hover:text-muted flex w-4 cursor-grab items-center justify-center"
              :title="t('grid.drag')"
            >
              <GripVertical class="size-4" />
            </span>
            <button
              class="hover:bg-soft flex min-w-0 flex-1 flex-col gap-px rounded-md px-1 py-1.5 text-start"
              :title="t('grid.edit')"
              @click="openHabit(task.id)"
            >
              <span
                class="flex items-start gap-1.5 text-sm leading-tight font-medium break-words"
                :class="task.paused ? 'text-muted' : ''"
              >
                <span
                  v-if="task.color"
                  class="mt-1 size-2 shrink-0 rounded-full bg-(--habit)"
                  :style="habitColorStyle(task)"
                ></span>
                <span class="min-w-0">
                  <template v-if="task.emoji">{{ task.emoji }}&nbsp;</template>
                  {{ task.title }}
                </span>
              </span>
              <span v-if="habitMeta(task)" class="text-muted text-[11px]">
                {{ habitMeta(task) }}
              </span>
            </button>
          </div>

          <div
            v-for="day in monthDays"
            :key="day"
            class="relative flex w-7 shrink-0 flex-col justify-center border-s py-0.5"
            :class="columnClass(day)"
          >
            <!-- Заметка к дню: точка в углу клетки, текст в подсказке -->
            <button
              v-if="task.notes?.[day - 1]"
              class="hide-print absolute end-0 top-0 z-[1] flex size-3 items-center justify-center"
              :title="task.notes[day - 1]"
              :aria-label="t('note.open', { title: task.title, day })"
              @click="openNote(task.id, day)"
            >
              <span class="bg-accent size-1.5 rounded-full"></span>
            </button>
            <button
              v-for="(subtask, index) in task.subtasks"
              :key="subtask.id"
              class="flex w-full items-center justify-center disabled:cursor-default"
              :class="task.subtasks.length > 1 ? 'h-8' : 'h-10'"
              :disabled="isFuture(day)"
              :aria-label="
                t('mark.cell', {
                  title: task.title,
                  day,
                  subtask: index + 1,
                  state: markState(subtask.marks[day - 1]),
                })
              "
              @click="clickMark($event, task, subtask, day)"
              @contextmenu.prevent="
                !isFuture(day) && store.toggleSkip(task.id, subtask.id, day - 1)
              "
            >
              <MarkCircle
                :mark="subtask.marks[day - 1]"
                :future="isFuture(day)"
                :color="task.color"
              />
            </button>
          </div>

          <div class="flex w-[110px] shrink-0 flex-col justify-center gap-[5px] px-4">
            <span class="text-[13px] font-semibold" :class="task.paused ? 'text-muted' : ''">
              {{ task.progress }}%
            </span>
            <span class="bg-line flex h-1 rounded-full">
              <span
                class="rounded-full"
                :class="task.color ? 'bg-(--habit)' : 'bg-ink'"
                :style="{
                  ...habitColorStyle(task),
                  width: `${Math.min(100, parseFloat(task.progress) || 0)}%`,
                }"
              ></span>
            </span>
          </div>
        </div>
      </VueDraggableNext>

      <!-- Добавление и легенда -->
      <div class="hide-print sticky start-0 w-fit">
        <button
          class="text-muted hover:text-ink flex h-12 items-center gap-1.5 ps-8 pe-4 text-sm"
          @click="openNewHabit"
        >
          <Plus class="size-4" />
          {{ t('grid.addHabit') }}
        </button>
      </div>
      <div
        class="hide-print text-muted sticky start-0 flex w-fit flex-wrap gap-x-5 gap-y-2 px-8 pt-2 text-xs"
      >
        <span class="flex items-center gap-1.5">
          <span class="bg-ink size-3 rounded-full"></span>
          {{ t('grid.legendDone') }}
        </span>
        <span class="flex items-center gap-1.5">
          <span class="border-muted size-3 rounded-full border-[1.5px] border-dashed"></span>
          {{ t('grid.legendSkip') }}
        </span>
        <span>{{ t('grid.legendClear') }}</span>
        <span>{{ t('grid.legendDay') }}</span>
        <span>{{ t('grid.legendNote') }}</span>
      </div>
    </div>
  </div>
</template>
