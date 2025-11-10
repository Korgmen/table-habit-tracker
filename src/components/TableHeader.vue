<script setup>
  import { useHabitUtils } from '../composables/useHabitUtils';
  import HeaderDay from './HeaderDay.vue';

  const { isEndOfWeek, monthDays } = useHabitUtils();
</script>

<template>
  <div class="relative flex min-w-[960px] flex-col items-center gap-2.5 p-5">
    <div class="flex items-end-safe gap-2">
      <HeaderDay v-for="day in monthDays" :key="day" :day="day" :isEndOfWeek="isEndOfWeek" />
    </div>
  </div>
</template>
