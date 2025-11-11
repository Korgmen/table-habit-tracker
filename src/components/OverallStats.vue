<script setup>
  import { useHabitStore } from '@/stores/habitStore';
  import { useI18n } from 'vue-i18n';

  const store = useHabitStore();
  const { t } = useI18n();
</script>

<template>
  <div class="flex w-full gap-1.5 md:w-fit print:w-fit">
    <!-- Общий средний процент выполнения всех задач -->
    <div class="hide-print flex flex-1 items-center md:flex-auto print:flex-auto">
      <p
        class="-mr-0.5 flex h-8 w-fit flex-1 cursor-default items-center justify-center self-start border-2 px-3 py-1.5 text-sm font-semibold italic md:flex-auto md:text-base print:flex-auto print:text-base"
      >
        {{ t('general.allAveragePer') }}
      </p>
      <p
        class="flex h-8 w-fit cursor-default items-center justify-center self-start border-2 px-3 py-1.5 text-sm font-semibold italic md:text-base print:text-base"
      >
        {{ store.overallProgress }}%
      </p>
    </div>

    <!-- Оценка -->
    <div class="hide-print flex items-center">
      <p
        class="-mr-0.5 flex h-8 w-fit cursor-default items-center justify-center self-start border-2 px-3 py-1.5 text-sm font-semibold italic md:text-base print:text-base"
      >
        {{ t('general.grade') }}
      </p>
      <p
        class="flex h-8 w-fit cursor-default items-center justify-center self-start border-2 px-3 py-1.5 text-sm font-semibold italic md:text-base print:text-base"
      >
        {{ store.overallGrade }}
      </p>
    </div>
  </div>
</template>
