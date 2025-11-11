<script setup>
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import HeaderDay from '@/components/HeaderDay.vue';

  const { isEndOfWeek, monthDays } = useHabitUtils();
</script>

<template>
  <div class="relative flex flex-col items-center gap-2.5 px-2 py-3 md:p-5 print:p-5">
    <div class="flex items-end-safe gap-0.5 md:gap-2 print:gap-2">
      <HeaderDay
        v-for="day in monthDays"
        :key="day"
        :day="day"
        :isEndOfWeek="d => isEndOfWeek(d, day === monthDays[monthDays.length - 1])"
      />
    </div>
  </div>
</template>
