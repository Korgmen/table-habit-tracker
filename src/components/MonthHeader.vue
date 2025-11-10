<script setup>
  import { useHabitStore } from '../stores/habitStore';
  import { useHabitUtils } from '../composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';
  import { ArrowBigLeft, ArrowBigRight } from 'lucide-vue-next';

  const store = useHabitStore();
  const { canNextMonth } = useHabitUtils();
  const { t } = useI18n();
</script>

<template>
  <h1 class="flex flex-auto items-center gap-1.5">
    <!-- Кнопка перехода к предыдущему месяцу -->
    <button
      class="hide-print relative flex h-8 cursor-pointer items-center justify-center border-2 px-1.5"
      :aria-label="t('control.prevMonth')"
      @click="store.prevMonth"
    >
      <ArrowBigLeft class="w-5" />
    </button>

    <!-- Название текущего месяца и года -->
    <p
      class="flex h-8 w-fit cursor-default items-center justify-center self-start border-2 px-3 py-1.5 font-semibold italic"
    >
      {{ store.monthName }} {{ store.currentYear }}
    </p>

    <!-- Кнопка перехода к следующему месяцу (отключается, если нельзя) -->
    <button
      class="hide-print relative flex h-8 items-center justify-center border-2 px-1.5"
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
