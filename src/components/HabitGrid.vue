<script setup>
  import { VueDraggableNext } from 'vue-draggable-next';
  import { useHabitStore } from '@/stores/habitStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { GripVertical, Plus } from 'lucide-vue-next';
  import MarkCircle from '@/components/MarkCircle.vue';

  const store = useHabitStore();
  const { monthDays, isWeekStart, isWeekend, isFuture, todayDay, weekdayLabel } = useHabitUtils();
  const { t } = useI18n();
  const { openNewHabit, openHabit } = useModals(t);

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
          @click="store.toggleDay(day - 1, true)"
          @contextmenu.prevent="!isFuture(day) && store.toggleDay(day - 1, false)"
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
        v-model="store.tasks"
        item-key="id"
        handle=".drag-handle"
        ghost-class="opacity-40"
        @end="store.saveState"
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
              <span class="text-sm leading-tight font-medium break-words">{{ task.title }}</span>
              <span v-if="task.subtasks.length > 1" class="text-muted text-[11px]">
                {{ t('grid.perDay', { count: task.subtasks.length }) }}
              </span>
            </button>
          </div>

          <div
            v-for="day in monthDays"
            :key="day"
            class="flex w-7 shrink-0 flex-col justify-center border-s py-0.5"
            :class="columnClass(day)"
          >
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
              @click="store.cycleMark(task.id, subtask.id, day - 1)"
              @contextmenu.prevent="
                !isFuture(day) && store.toggleSkip(task.id, subtask.id, day - 1)
              "
            >
              <MarkCircle :mark="subtask.marks[day - 1]" :future="isFuture(day)" />
            </button>
          </div>

          <div class="flex w-[110px] shrink-0 flex-col justify-center gap-[5px] px-4">
            <span class="text-[13px] font-semibold">{{ task.progress }}%</span>
            <span class="bg-line flex h-1 rounded-full">
              <span
                class="bg-ink rounded-full"
                :style="{ width: `${Math.min(100, parseFloat(task.progress) || 0)}%` }"
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
      </div>
    </div>
  </div>
</template>
