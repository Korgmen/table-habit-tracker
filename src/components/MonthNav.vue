<script setup>
  import { useHabitStore } from '@/stores/habitStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';
  import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

  defineProps({
    /** Компактная версия для телефона: без рамок у стрелок */
    compact: Boolean,
  });

  const store = useHabitStore();
  const { canNextMonth } = useHabitUtils();
  const { t } = useI18n();
</script>

<template>
  <h1 class="m-0 flex items-center" :class="compact ? '' : 'gap-1'">
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
    <span
      class="text-center font-bold tracking-tight"
      :class="compact ? 'min-w-[150px] text-[22px]' : 'min-w-[190px] px-2.5 text-[28px]'"
    >
      {{ store.monthName }} {{ store.currentYear }}
    </span>
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
  </h1>
</template>
