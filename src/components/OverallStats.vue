<script setup>
  import { useHabitStore } from '@/stores/habitStore';
  import { useI18n } from 'vue-i18n';

  const store = useHabitStore();
  const { t } = useI18n();
</script>

<template>
  <!-- Общий средний процент выполнения всех задач -->
  <div class="hide-print flex items-center">
    <p
      class="-mr-0.5 flex h-8 w-fit cursor-default items-center justify-center self-start border-2 px-3 py-1.5 font-semibold italic"
    >
      {{ t('general.allAveragePer') }}
    </p>
    <p
      class="flex h-8 w-fit cursor-default items-center justify-center self-start border-2 px-3 py-1.5 font-semibold italic"
    >
      {{ store.overallProgress }}%
    </p>
  </div>

  <!-- Оценка -->
  <div class="hide-print flex items-center">
    <p
      class="-mr-0.5 flex h-8 w-fit cursor-default items-center justify-center self-start border-2 px-3 py-1.5 font-semibold italic"
    >
      {{ t('general.grade') }}
    </p>
    <p
      class="flex h-8 w-fit cursor-default items-center justify-center self-start border-2 px-3 py-1.5 font-semibold italic"
    >
      {{ store.overallGrade }}
    </p>
  </div>
</template>
