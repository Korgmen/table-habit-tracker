<!-- src/components/HeaderDay.vue -->
<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '../stores/habitStore';

  const props = defineProps({
    day: {
      type: Number,
      required: true,
    },
  });

  const store = useHabitStore();

  const weekEndDay = computed(() => (store.weekStart === 'monday' ? 0 : 6));

  const getHeaderCircleState = computed(() => {
    if (props.day > store.today) return 'future';
    return 'completed';
  });

  const isEndOfWeek = computed(() => {
    const date = new Date(store.currentYear, store.currentMonth, props.day);
    return store.showWeekSeparators && date.getDay() === weekEndDay.value;
  });

  const isAllFalse = computed(
    () =>
      store.tasks.length > 0 &&
      store.tasks.every(t => t.subtasks.every(s => s.marks[props.day - 1] === false))
  );

  const handleHeaderClick = event => {
    const dayIndex = props.day - 1;
    if (dayIndex >= store.today) return;
    const isRightClick = event.button === 2;
    store.updateHeaderDay(dayIndex, isRightClick ? false : null);
  };
</script>

<template>
  <div
    class="flex w-5 flex-col items-center gap-[5px] transition-all duration-300 ease-in-out"
    :class="{ 'opacity-50': getHeaderCircleState === 'future' }"
  >
    <p class="text-[18px] font-medium">{{ day }}</p>
    <div
      class="relative flex h-3 w-3 items-center justify-center rounded-[50%] border-2 transition-all duration-300 ease-in-out before:absolute before:h-0.5 before:w-full before:rotate-45 before:bg-current before:opacity-0 before:transition-all before:duration-300 before:ease-in-out after:absolute after:h-0.5 after:w-full after:-rotate-45 after:bg-current after:opacity-0 after:transition-all after:duration-300 after:ease-in-out"
      :class="{
        'cursor-not-allowed': getHeaderCircleState === 'future',
        'cursor-pointer bg-current': getHeaderCircleState === 'completed',
        'bg-transparent before:opacity-100 after:opacity-100': isAllFalse,
      }"
      @click="handleHeaderClick"
      @contextmenu.prevent="handleHeaderClick"
    ></div>
  </div>
  <div
    v-if="isEndOfWeek"
    class="h-4 border-1 bg-current"
    :class="{ 'opacity-50': getHeaderCircleState === 'future' }"
  ></div>
</template>
