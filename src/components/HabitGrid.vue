<script setup>
  import { VueDraggableNext } from 'vue-draggable-next';
  import { useHabitStore } from '@/stores/habitStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useSearch } from '@/composables/useSearch';
  import { useGridNavigation } from '@/composables/useGridNavigation';
  import { useI18n } from 'vue-i18n';
  import { ref, computed, watch, nextTick, onMounted } from 'vue';
  import { currentStreak } from '@/utils/stats';
  import { Plus, Search } from 'lucide-vue-next';
  import HabitRow from '@/components/HabitRow.vue';

  const store = useHabitStore();
  const {
    monthDays,
    isWeekStart,
    isWeekend,
    isFuture,
    todayDay,
    weekdayLabel,
    weekdayName,
    weekOrder,
    currentMonthLabel,
  } = useHabitUtils();
  const { t } = useI18n();
  const { openNewHabit, openNote, openSearch, toastWithUndo } = useModals(t);
  const { query, filteredTasks, isFiltering } = useSearch();

  /** Таблица: стрелки ходят по клеткам, X – пропуск, Alt+Enter – заметка */
  const grid = ref(null);
  useGridNavigation(grid, {
    skip: el => {
      const taskId = store.tasks.find(task => String(task.id) === el.dataset.task)?.id;
      const subtask = store.tasks
        .find(task => task.id === taskId)
        ?.subtasks.find(item => String(item.id) === el.dataset.sub);
      if (subtask) store.toggleSkip(taskId, subtask.id, Number(el.dataset.col) - 1);
    },
    note: el => {
      const task = store.tasks.find(item => String(item.id) === el.dataset.task);
      if (task) openNote(task.id, Number(el.dataset.col));
    },
  });

  /**
   * Сегодняшний день виден без прокрутки: на узком экране таблица сдвигается к нему.
   * scrollIntoView считает направление сам, в RTL сдвиг идёт влево.
   */
  const showToday = async () => {
    await nextTick();
    if (!todayDay.value) return;
    grid.value
      ?.querySelector(`[data-row="-1"][data-col="${todayDay.value}"]`)
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  };
  onMounted(showToday);
  watch(() => store.currentMonthKey, showToday);

  /** Порядок меняется перетаскиванием только в полном списке, не в отфильтрованном */
  const reorder = list => {
    if (!isFiltering.value) store.reorderTasks(list);
  };

  /** Текущая серия привычки (через месяцы) к сегодня или к концу открытого прошлого месяца */
  const streaks = computed(() =>
    Object.fromEntries(
      store.tasks.map(task => [
        task.id,
        currentStreak(store.archiveView, task.title, store.statsOptions, store.currentMonthKey),
      ])
    )
  );

  /** Подпись серии: от двух дней или от одной недели цели */
  const streakLabel = task => {
    const { count, unit } = streaks.value[task.id];
    if (unit === 'week' ? count < 1 : count < 2) return '';
    return t('grid.streak', {
      value: t(unit === 'week' ? 'stats.weeks' : 'stats.days', { count }, count),
    });
  };

  /** Вторая строка под названием: пауза, отметок в день, расписание или цель */
  const habitMeta = task => {
    const parts = [];
    if (task.paused) parts.push(t('grid.paused'));
    if (task.subtasks.length > 1) {
      parts.push(t('grid.perDay', { count: task.subtasks.length }, task.subtasks.length));
    }
    if (task.schedule) {
      parts.push(
        weekOrder.value
          .filter(weekday => task.schedule.includes(weekday))
          .map(weekdayName)
          .join(', ')
      );
    }
    if (task.goal) parts.push(t('habit.goalCount', { count: task.goal }, task.goal));
    return parts.join(' · ');
  };

  /**
   * Строки таблицы: привычка, номер её первой строки отметок (для стрелок) и подписи.
   * Строкам уходят строки и числа: перерисовывается только строка, у которой они изменились.
   */
  const rows = computed(() => {
    let rowStart = 0;
    return filteredTasks.value.map(task => {
      const row = { task, rowStart, meta: habitMeta(task), streak: streakLabel(task) };
      rowStart += task.subtasks.length;
      return row;
    });
  });

  /** Отметка всего дня меняет много клеток сразу: тост предлагает отменить */
  const markDay = (day, state) => {
    if (isFuture(day)) return;
    const before = store.lastChangeId;
    store.toggleDay(day - 1, state);
    if (store.lastChangeId !== before) toastWithUndo(t('history.dayChanged', { day }));
  };

  /** Колонки дней: разделитель недели и подсветка сегодняшнего дня; один массив на все строки */
  const columns = computed(() =>
    monthDays.value.map(day => [
      store.showWeekSeparators && isWeekStart(day) ? 'border-line' : 'border-transparent',
      day === todayDay.value ? 'bg-accent/9' : '',
    ])
  );

  /** Номер дня в шапке */
  const dayNumberClass = day => {
    if (day === todayDay.value) return 'bg-accent text-white';
    if (isFuture(day)) return 'text-faint';
    if (isWeekend(day)) return 'text-muted';
    return 'text-ink';
  };
</script>

<template>
  <div class="border-line relative flex-1 overflow-auto border-t print:overflow-visible">
    <div class="inline-flex min-w-full flex-col pb-4 select-none">
      <!-- Таблица отметок: в порядке Tab одна клетка, по клеткам – стрелками -->
      <div
        ref="grid"
        role="grid"
        :aria-label="t('habit.marksFor', { month: currentMonthLabel })"
        class="flex flex-col"
      >
        <!-- Шапка: дни месяца -->
        <div class="border-line bg-bg sticky top-0 z-[3] flex border-b" role="row">
          <div
            class="border-line bg-bg text-muted sticky start-0 z-[4] flex w-[220px] shrink-0 items-end border-e ps-4 pb-2.5 text-xs"
            role="columnheader"
          >
            {{ t('grid.habit') }}
          </div>
          <div
            v-for="day in monthDays"
            :key="day"
            class="flex w-7 shrink-0 border-s pointer-coarse:w-10"
            :class="columns[day - 1]"
            role="columnheader"
          >
            <button
              class="enabled:hover:bg-soft flex w-full flex-col items-center gap-[3px] pt-2 pb-1.5"
              tabindex="-1"
              data-row="-1"
              :data-col="day"
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
          </div>
          <div
            class="text-muted flex w-[110px] shrink-0 items-end px-4 pb-2.5 text-xs"
            role="columnheader"
          >
            {{ t('grid.month') }}
          </div>
        </div>

        <!-- Строки привычек -->
        <VueDraggableNext
          :model-value="filteredTasks"
          item-key="id"
          handle=".drag-handle"
          ghost-class="opacity-40"
          role="rowgroup"
          @update:model-value="reorder"
        >
          <HabitRow
            v-for="row in rows"
            :key="row.task.id"
            :task="row.task"
            :row-start="row.rowStart"
            :days="monthDays"
            :columns="columns"
            :today="store.today"
            :filtering="isFiltering"
            :meta="row.meta"
            :streak="row.streak"
          />
        </VueDraggableNext>
      </div>

      <!-- Поиск: ничего в месяце или переход к поиску по всем месяцам и заметкам -->
      <div v-if="isFiltering" class="hide-print sticky start-0 flex w-fit flex-col gap-2 ps-8 pt-3">
        <span v-if="filteredTasks.length === 0" class="text-muted text-sm">
          {{ t('search.noneMonth') }}
        </span>
        <button
          class="border-line2 hover:bg-soft flex h-10 w-fit items-center gap-1.5 rounded-[10px] border px-3 text-sm"
          @click="openSearch(query)"
        >
          <Search class="size-4" />
          {{ t('search.archive', { query: query.trim() }) }}
        </button>
      </div>

      <!-- Добавление и легенда -->
      <div v-else class="hide-print sticky start-0 w-fit">
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
