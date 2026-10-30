<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';
  import { currentStreak, bestStreak, habitMonths } from '@/utils/stats';
  import MonthBars from '@/components/MonthBars.vue';

  const props = defineProps({
    /** Привычка открытого месяца */
    task: { type: Object, required: true },
  });

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { currentMonthLabel } = useHabitUtils();
  const { t } = useI18n();

  /** Сколько последних месяцев с привычкой показывает график */
  const HISTORY_MONTHS = 12;

  /** Выполнено и пропусков по учитываемым дням (как в прогрессе) */
  const counts = computed(() => {
    let done = 0;
    let skips = 0;
    props.task.subtasks.forEach(item => {
      for (let i = 0; i < store.monthCtx.maxDay; i++) {
        if (item.marks[i] === true) done++;
        else if (item.marks[i] === false) skips++;
      }
    });
    return { done, skips };
  });

  /** Серия к сегодня (или к концу открытого прошлого месяца) и лучшая за все месяцы */
  const current = computed(() =>
    currentStreak(store.archiveView, props.task.title, store.statsOptions, store.currentMonthKey)
  );
  const best = computed(() => bestStreak(store.archiveView, props.task.title, store.statsOptions));

  /** Процент по месяцам, где привычка была; средний – по всем таким месяцам */
  const history = computed(() =>
    habitMonths(store.archiveView, props.task.title, store.statsOptions)
  );
  const average = computed(() =>
    history.value.length
      ? history.value.reduce((sum, item) => sum + item.value, 0) / history.value.length
      : 0
  );

  const streakText = ({ count, unit }) =>
    t(unit === 'week' ? 'stats.weeks' : 'stats.days', { count });

  const tiles = computed(() => [
    [t('habit.statMonth', { month: currentMonthLabel.value }), `${props.task.progress}%`],
    [t('habit.statDone'), counts.value.done],
    [t('habit.statSkips'), counts.value.skips],
    [t('habit.statCurrent'), streakText(current.value)],
    [t('habit.statBest'), streakText(best.value)],
    [t('habit.statAvg'), `${average.value.toFixed(1)}%`],
  ]);

  /** Клик по месяцу графика открывает его, окно привычки закрывается */
  const openMonth = key => {
    modalStore.closeModal();
    store.openMonthKey(key);
  };
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="grid grid-cols-3 gap-2">
      <div
        v-for="[label, value] in tiles"
        :key="label"
        class="bg-soft flex min-w-0 flex-col gap-0.5 rounded-xl p-3"
      >
        <span class="text-muted truncate text-xs">{{ label }}</span>
        <span class="text-lg font-bold">{{ value }}</span>
      </div>
    </div>
    <div v-if="history.length > 1" class="flex flex-col gap-2">
      <span class="text-sm font-medium">{{ t('habit.history') }}</span>
      <MonthBars
        :items="history.slice(-HISTORY_MONTHS)"
        :color="task.color"
        :active-key="store.currentMonthKey"
        @select="openMonth"
      />
    </div>
  </div>
</template>
