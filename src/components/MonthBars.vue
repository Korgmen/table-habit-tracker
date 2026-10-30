<script setup>
  import { computed } from 'vue';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';

  const props = defineProps({
    /** Столбцы по порядку: [{ key: 'YYYY-MM', value: процент | null }], null – нет данных */
    items: { type: Array, required: true },
    /** Цвет привычки (ключ HABIT_COLORS) для столбцов; без него – цвет отметки «выполнено» */
    color: { type: String, default: null },
    /** Ключ выделенного месяца (открытый) */
    activeKey: { type: String, default: null },
  });

  const emit = defineEmits([
    /** Клик по месяцу: открыть его */
    'select',
  ]);

  const { monthShortLabel, monthKeyLabel } = useHabitUtils();
  const { t } = useI18n();

  /** Короткое название месяца без точки: «сент», «Sep», «يناير» */
  const shortName = key => monthShortLabel(key).replace('.', '');

  /** В языке нет коротких названий месяцев (арабский): все подписи – номера месяцев */
  const numeric = computed(() => props.items.some(item => shortName(item.key).length > 4));

  /** Подпись под столбцом: три буквы, чтобы 12 месяцев помещались на телефоне, или номер */
  const barLabel = key =>
    numeric.value ? String(Number(key.slice(5))) : shortName(key).slice(0, 3);

  /** Высота столбца в процентах высоты области: у нуля тонкая полоска, чтобы месяц был виден */
  const barHeight = value => `${Math.max(Math.min(value, 100), 2)}%`;
</script>

<template>
  <!-- Столбцы на flex: порядок месяцев следует направлению текста (RTL) -->
  <div class="flex h-40 items-stretch gap-1">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="group flex min-w-0 flex-1 flex-col items-center gap-1 disabled:cursor-default"
      :disabled="item.value === null"
      :aria-label="
        item.value === null
          ? `${monthKeyLabel(item.key)}: ${t('stats.noData')}`
          : t('stats.monthCell', { month: monthKeyLabel(item.key), pct: Math.round(item.value) })
      "
      @click="emit('select', item.key)"
    >
      <span class="text-muted h-3.5 text-[10px] leading-none">
        {{ item.value === null ? '' : Math.round(item.value) }}
      </span>
      <span class="flex w-full max-w-7 flex-1 items-end">
        <span
          v-if="item.value !== null"
          class="w-full rounded-t-[4px] group-enabled:group-hover:opacity-80"
          :class="color ? 'bg-(--habit)' : 'bg-ink'"
          :style="{
            height: barHeight(item.value),
            ...(color ? { '--habit': `var(--habit-${color})` } : {}),
          }"
        ></span>
        <span v-else class="border-line2 w-full border-t border-dashed"></span>
      </span>
      <span
        class="w-full overflow-hidden text-center text-[10px] leading-none whitespace-nowrap"
        :class="item.key === activeKey ? 'text-ink font-semibold' : 'text-muted'"
        aria-hidden="true"
      >
        {{ barLabel(item.key) }}
      </span>
    </button>
  </div>
</template>
