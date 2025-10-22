<!-- src/components/MonthHeader.vue -->
<script setup>
  import { useHabitStore } from '../stores/habitStore';
  import { computed } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { ArrowBigLeft, ArrowBigRight } from 'lucide-vue-next';

  const store = useHabitStore();
  const { t } = useI18n();

  const canNextMonth = computed(() => {
    const newDate = new Date(store.currentDate);
    newDate.setMonth(store.currentMonth + 1);
    const newMonthKey = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    const realMonthKey = `${store.realDate.getFullYear()}-${String(store.realDate.getMonth() + 1).padStart(2, '0')}`;
    return newMonthKey <= realMonthKey;
  });
</script>

<template>
  <h1 class="flex flex-auto items-center gap-1.5">
    <button
      class="hide-print relative flex h-8 cursor-pointer items-center justify-center border-2 px-1.5"
      :aria-label="t('control.prevMonth')"
      @click="store.prevMonth"
    >
      <ArrowBigLeft class="w-5" />
    </button>
    <p
      class="flex h-8 w-fit cursor-default items-center justify-center self-start border-2 px-3 py-1.5 font-semibold italic"
    >
      {{ store.monthName }} {{ store.currentYear }}
    </p>
    <button
      class="hide-print relative flex h-8 cursor-pointer items-center justify-center border-2 px-1.5"
      :aria-label="t('control.nextMonth')"
      :class="{ 'cursor-not-allowed opacity-50': !canNextMonth }"
      @click="canNextMonth && store.nextMonth"
    >
      <ArrowBigRight class="w-5" />
    </button>
  </h1>
</template>
