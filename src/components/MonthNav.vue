<script setup>
  import { useHabitStore } from '@/stores/habitStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';
  import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

  defineProps({
    /** Компактная версия для телефона: без рамок у стрелок и без кнопки текущего месяца */
    compact: Boolean,
  });

  const store = useHabitStore();
  const { canNextMonth, isCurrentMonth } = useHabitUtils();
  const { t } = useI18n();
</script>

<template>
  <!-- Стрелки стоят перед названием, чтобы не смещаться от его длины -->
  <div class="flex items-center" :class="compact ? '' : 'gap-1'">
    <button
      class="hide-print text-ink flex items-center justify-center"
      :class="
        compact ? 'size-11' : 'border-line bg-surface hover:bg-soft size-9 rounded-[10px] border'
      "
      :aria-label="t('month.prev')"
      :title="compact ? undefined : t('month.prevHint')"
      @click="store.prevMonth()"
    >
      <ChevronLeft class="size-5 rtl:-scale-x-100" />
    </button>
    <button
      class="hide-print disabled:text-faint flex items-center justify-center"
      :class="
        compact
          ? 'size-11'
          : 'border-line bg-surface enabled:hover:bg-soft size-9 rounded-[10px] border'
      "
      :disabled="!canNextMonth"
      :aria-label="t('month.next')"
      :title="compact ? undefined : t('month.nextHint')"
      @click="store.nextMonth()"
    >
      <ChevronRight class="size-5 rtl:-scale-x-100" />
    </button>
    <h1
      class="m-0 font-bold tracking-tight whitespace-nowrap"
      :class="compact ? 'ps-1 text-[22px]' : 'ps-2.5 pe-1.5 text-[28px]'"
    >
      {{ store.monthName }} {{ store.currentYear }}
    </h1>
    <button
      v-if="!compact && !isCurrentMonth"
      class="hide-print border-line bg-surface hover:bg-soft h-9 rounded-[10px] border px-3 text-[13px] font-semibold whitespace-nowrap"
      :title="t('month.currentHint')"
      @click="store.goToToday()"
    >
      {{ t('month.current') }}
    </button>
  </div>
</template>
