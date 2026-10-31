<script setup>
  import { ref, computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalEntry } from '@/composables/useModals';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';
  import {
    archiveYears,
    monthAverages,
    yearHeat,
    monthHeat,
    yearHabits,
    bestOverall,
  } from '@/utils/stats';
  import { X, ChevronLeft, ChevronRight } from 'lucide-vue-next';
  import Sheet from '@/components/Sheet.vue';
  import MonthBars from '@/components/MonthBars.vue';
  import YearHeat from '@/components/YearHeat.vue';
  import MonthHeat from '@/components/MonthHeat.vue';

  const store = useHabitStore();
  const { currentMonthLabel, habitColorStyle } = useHabitUtils();
  const { t } = useI18n();

  const { close, closeAll } = useModalEntry();

  /** Архив с рабочим списком открытого месяца и параметры расчёта */
  const archive = computed(() => store.archiveView);
  const opts = computed(() => store.statsOptions);

  const years = computed(() => archiveYears(archive.value, opts.value));
  /** Год открытого месяца, а если в нём нет привычек – текущий */
  const year = ref(
    years.value.includes(store.currentYear) ? store.currentYear : store.realDate.getFullYear()
  );
  const yearIndex = computed(() => years.value.indexOf(year.value));

  const monthKeys = computed(() =>
    Array.from({ length: 12 }, (_, month) => `${year.value}-${String(month + 1).padStart(2, '0')}`)
  );

  /** Средние по месяцам года; будущие месяцы без данных */
  const months = computed(() => monthAverages(archive.value, monthKeys.value, opts.value));

  /** Средний процент года: по месяцам, где были привычки */
  const yearAverage = computed(() => {
    const values = months.value.map(item => item.avg).filter(avg => avg !== null);
    return values.length ? values.reduce((sum, avg) => sum + avg, 0) / values.length : null;
  });

  const heat = computed(() => yearHeat(archive.value, year.value, opts.value));
  const monthDaysHeat = computed(() => monthHeat(archive.value, store.currentMonthKey, opts.value));
  const habits = computed(() => yearHabits(archive.value, year.value, opts.value));
  const best = computed(() => bestOverall(archive.value, opts.value));

  /** Выполненных отметок за год по всем привычкам */
  const yearDone = computed(() => habits.value.reduce((sum, habit) => sum + habit.done, 0));

  const streakText = ({ count, unit }) =>
    t(unit === 'week' ? 'stats.weeks' : 'stats.days', { count }, count);

  /** Клик по месяцу (график, карта) закрывает окна и открывает его */
  const openMonth = key => {
    closeAll();
    store.openMonthKey(key);
  };
</script>

<template>
  <Sheet :label="t('stats.title')" width="lg" @close="close">
    <div class="bg-surface sticky top-0 z-[1] flex items-center justify-between px-6 pt-5 pb-3">
      <span class="text-[22px] font-bold tracking-tight">{{ t('stats.title') }}</span>
      <div class="flex items-center gap-2">
        <!-- Год -->
        <div class="flex items-center">
          <button
            class="disabled:text-faint flex size-9 items-center justify-center"
            :disabled="yearIndex <= 0"
            :aria-label="t('stats.prevYear')"
            @click="year = years[yearIndex - 1]"
          >
            <ChevronLeft class="size-5 rtl:-scale-x-100" />
          </button>
          <span class="min-w-12 text-center text-[15px] font-semibold">{{ year }}</span>
          <button
            class="disabled:text-faint flex size-9 items-center justify-center"
            :disabled="yearIndex >= years.length - 1"
            :aria-label="t('stats.nextYear')"
            @click="year = years[yearIndex + 1]"
          >
            <ChevronRight class="size-5 rtl:-scale-x-100" />
          </button>
        </div>
        <button
          class="bg-soft flex size-10 items-center justify-center rounded-full"
          :aria-label="t('common.close')"
          @click="close"
        >
          <X class="size-5" />
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-6 px-6 pt-1 pb-[max(env(safe-area-inset-bottom),24px)]">
      <!-- Итоги -->
      <div class="grid grid-cols-3 gap-2">
        <div class="bg-soft flex min-w-0 flex-col gap-0.5 rounded-xl p-3">
          <span class="text-muted truncate text-xs">{{ t('stats.yearAvg', { year }) }}</span>
          <span class="text-lg font-bold">
            {{ yearAverage === null ? '–' : `${yearAverage.toFixed(1)}%` }}
          </span>
        </div>
        <div class="bg-soft flex min-w-0 flex-col gap-0.5 rounded-xl p-3">
          <span class="text-muted truncate text-xs">{{ t('stats.doneMarks') }}</span>
          <span class="text-lg font-bold">{{ yearDone }}</span>
        </div>
        <div class="bg-soft flex min-w-0 flex-col gap-0.5 rounded-xl p-3">
          <span class="text-muted truncate text-xs">{{ t('stats.bestStreak') }}</span>
          <span class="text-lg font-bold">{{ best ? streakText(best) : '–' }}</span>
          <span v-if="best" class="text-muted truncate text-xs">
            {{ best.emoji ? `${best.emoji} ${best.title}` : best.title }}
          </span>
        </div>
      </div>

      <!-- Открытый месяц по дням -->
      <section class="flex flex-col gap-2.5">
        <h3 class="text-muted text-xs font-semibold tracking-wider uppercase">
          {{ t('stats.heatMonth', { month: currentMonthLabel }) }}
        </h3>
        <MonthHeat :month-key="store.currentMonthKey" :days="monthDaysHeat" />
      </section>

      <!-- Средний процент по месяцам -->
      <section class="flex flex-col gap-2.5">
        <h3 class="text-muted text-xs font-semibold tracking-wider uppercase">
          {{ t('stats.byMonth') }}
        </h3>
        <MonthBars
          :items="months.map(item => ({ key: item.key, value: item.avg }))"
          :active-key="store.currentMonthKey"
          @select="openMonth"
        />
      </section>

      <!-- Год по дням -->
      <section class="flex flex-col gap-2.5">
        <h3 class="text-muted text-xs font-semibold tracking-wider uppercase">
          {{ t('stats.heatYear') }}
        </h3>
        <YearHeat :months="heat" @select="openMonth" />
      </section>

      <!-- Привычки года -->
      <section class="flex flex-col gap-2.5">
        <h3 class="text-muted text-xs font-semibold tracking-wider uppercase">
          {{ t('stats.habits', { year }) }}
        </h3>
        <span v-if="habits.length === 0" class="text-muted text-sm">
          {{ t('stats.empty', { year }) }}
        </span>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="text-muted text-xs">
              <th class="pb-1.5 text-start font-normal">{{ t('grid.habit') }}</th>
              <th class="pb-1.5 text-end font-normal">{{ t('stats.colAvg') }}</th>
              <th class="pb-1.5 text-end font-normal">{{ t('stats.colDone') }}</th>
              <th class="pb-1.5 text-end font-normal">{{ t('stats.colBest') }}</th>
              <th class="pb-1.5 text-end font-normal max-sm:hidden">{{ t('stats.colMonths') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="habit in habits" :key="habit.key" class="border-line border-t">
              <td class="py-2 pe-2">
                <span class="flex items-start gap-1.5 break-words">
                  <span
                    v-if="habit.color"
                    class="mt-1.5 size-2 shrink-0 rounded-full bg-(--habit)"
                    :style="habitColorStyle(habit)"
                  ></span>
                  <span class="min-w-0">
                    <template v-if="habit.emoji">{{ habit.emoji }}&nbsp;</template>
                    {{ habit.title }}
                  </span>
                </span>
              </td>
              <td class="py-2 text-end font-semibold whitespace-nowrap">
                {{ habit.avg.toFixed(1) }}%
              </td>
              <td class="py-2 ps-2 text-end">{{ habit.done }}</td>
              <td class="py-2 ps-2 text-end whitespace-nowrap">{{ streakText(habit.best) }}</td>
              <td class="py-2 ps-2 text-end max-sm:hidden">{{ habit.months }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </Sheet>
</template>
