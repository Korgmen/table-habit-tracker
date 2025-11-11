<script setup>
  import { useHabitStore } from '@/stores/habitStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';
  import { ArrowBigLeft, ArrowBigRight } from 'lucide-vue-next';

  const store = useHabitStore();
  const { canNextMonth } = useHabitUtils();
  const { t } = useI18n();
</script>

<template>
  <h1 class="flex w-full flex-auto items-center gap-1.5 md:w-fit print:w-fit">
    <!-- Кнопка перехода к предыдущему месяцу -->
    <button
      class="tap-highlight-transparent hide-print relative flex h-8 cursor-pointer touch-manipulation items-center justify-center border-2 px-1.5"
      :aria-label="t('control.prevMonth')"
      @click="store.prevMonth"
    >
      <ArrowBigLeft class="w-5" />
    </button>

    <!-- Название текущего месяца и года -->
    <p
      class="flex h-8 w-full cursor-default items-center justify-center self-start border-2 px-3 py-1.5 text-sm font-semibold italic md:w-fit md:text-base print:w-fit print:text-base"
    >
      {{ store.monthName }} {{ store.currentYear }}
    </p>

    <!-- Кнопка перехода к следующему месяцу (отключается, если нельзя) -->
    <button
      class="tap-highlight-transparent hide-print relative flex h-8 touch-manipulation items-center justify-center border-2 px-1.5"
      :aria-label="t('control.nextMonth')"
      :class="{
        'cursor-not-allowed opacity-25': !canNextMonth,
        'cursor-pointer': canNextMonth,
      }"
      @click="canNextMonth && store.nextMonth()"
    >
      <ArrowBigRight class="w-5" />
    </button>
  </h1>
</template>
