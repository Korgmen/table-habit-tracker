<script setup>
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';

  defineProps({
    /** Месяцы года: [{ key, days: [{ day, ratio, done, total, future }] }] (stats.yearHeat) */
    months: { type: Array, required: true },
  });

  const emit = defineEmits([
    /** Клик по месяцу: открыть его */
    'select',
  ]);

  const { monthShortLabel, monthKeyLabel, dayDateLabel, heatColor } = useHabitUtils();
  const { t } = useI18n();

  /** Подсказка клетки: «12 окт.: 5 из 7» */
  const cellTitle = (key, cell) =>
    cell.total > 0
      ? t('stats.dayCell', {
          date: dayDateLabel(key, cell.day),
          done: cell.done,
          total: cell.total,
        })
      : `${dayDateLabel(key, cell.day)}: ${t('stats.noData')}`;

  /** Ступени легенды: от «меньше» к «больше» */
  const legend = [0, 0.25, 0.5, 0.75, 1];
</script>

<template>
  <div class="flex flex-col gap-[3px]">
    <!-- Строка на месяц, клетка на день: 12 × 31 помещается и на телефоне -->
    <div v-for="month in months" :key="month.key" class="flex items-center gap-1.5">
      <button
        type="button"
        class="text-muted hover:text-ink w-9 shrink-0 truncate text-start text-[10px]"
        :aria-label="monthKeyLabel(month.key)"
        @click="emit('select', month.key)"
      >
        {{ monthShortLabel(month.key) }}
      </button>
      <div class="grid flex-1 grid-cols-[repeat(31,minmax(0,1fr))] gap-[2px]">
        <span
          v-for="cell in month.days"
          :key="cell.day"
          class="aspect-square rounded-[2px]"
          :class="cell.future ? 'border-line border' : ''"
          :style="cell.future ? undefined : { background: heatColor(cell.ratio) }"
          :title="cell.future ? undefined : cellTitle(month.key, cell)"
        ></span>
      </div>
    </div>
    <div class="text-muted flex items-center justify-end gap-1 pt-1.5 text-[10px]">
      <span class="pe-0.5">{{ t('stats.less') }}</span>
      <span
        v-for="ratio in legend"
        :key="ratio"
        class="size-2.5 rounded-[2px]"
        :style="{ background: heatColor(ratio) }"
      ></span>
      <span class="ps-0.5">{{ t('stats.more') }}</span>
    </div>
  </div>
</template>
