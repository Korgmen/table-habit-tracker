<script setup>
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';

  const props = defineProps({
    /** Ключ месяца 'YYYY-MM' (открытый месяц: календарь строится по нему) */
    monthKey: { type: String, required: true },
    /** Дни месяца: [{ day, ratio, done, total, future }] (stats.monthHeat) */
    days: { type: Array, required: true },
  });

  const { weekHeaders, leadingBlanks, todayDay, heatColor, heatTextLight, dayDateLabel } =
    useHabitUtils();
  const { t } = useI18n();

  /** Подсказка клетки: «12 окт.: 5 из 7» */
  const cellLabel = cell => {
    const date = dayDateLabel(props.monthKey, cell.day);
    return cell.total > 0
      ? t('stats.dayCell', { date, done: cell.done, total: cell.total })
      : `${date}: ${t('stats.noData')}`;
  };
</script>

<template>
  <!-- Календарь открытого месяца: цвет дня – доля выполненного; скринридер читает подписи дней -->
  <div class="grid grid-cols-7 gap-1">
    <span
      v-for="(header, headerIndex) in weekHeaders"
      :key="headerIndex"
      class="text-muted pb-0.5 text-center text-[11px]"
      aria-hidden="true"
    >
      {{ header }}
    </span>
    <span v-for="blank in leadingBlanks" :key="`b${blank}`"></span>
    <span
      v-for="cell in days"
      :key="cell.day"
      class="flex h-9 items-center justify-center rounded-lg text-xs font-semibold"
      :class="[
        cell.future
          ? 'border-line text-faint border'
          : heatTextLight(cell.ratio)
            ? 'text-bg'
            : 'text-ink',
        cell.day === todayDay ? 'ring-accent ring-2' : '',
      ]"
      :style="cell.future ? undefined : { background: heatColor(cell.ratio) }"
      :title="cell.future ? undefined : cellLabel(cell)"
      :role="cell.future ? undefined : 'img'"
      :aria-label="cell.future ? undefined : cellLabel(cell)"
      :aria-hidden="cell.future || undefined"
    >
      {{ cell.day }}
    </span>
  </div>
</template>
