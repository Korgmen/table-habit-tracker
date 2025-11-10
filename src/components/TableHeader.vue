<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '../stores/habitStore';
  import HeaderDay from './HeaderDay.vue';

  const store = useHabitStore();

  /** Массив всех дней текущего месяца (1 … daysInMonth) */
  const days = computed(() => Array.from({ length: store.daysInMonth }, (_, i) => i + 1));
</script>

<template>
  <div class="relative flex min-w-[960px] flex-col items-center gap-2.5 p-5">
    <div class="flex items-end-safe gap-2">
      <HeaderDay v-for="day in days" :key="day" :day="day" />
    </div>
  </div>
</template>
