<!-- src/components/TaskDay.vue -->
<script setup>
  import { useHabitStore } from '../stores/habitStore';

  const props = defineProps({
    day: Number,
    index: Number,
    task: Object,
    getMarkClass: Function,
    handleMarkClick: Function,
    handleTouchStart: Function,
    handleTouchEnd: Function,
    isEndOfWeek: Function,
  });

  const store = useHabitStore();
</script>

<template>
  <div
    class="flex w-5 flex-col items-center gap-[5px] transition-all duration-300 ease-in-out"
    :class="{ 'opacity-50': day > store.today }"
  >
    <p class="text-[18px] font-medium">{{ day }}</p>
    <template v-for="subtask in task.subtasks" :key="subtask.id">
      <div
        class="relative flex h-3 w-3 items-center justify-center rounded-[50%] border-2 border-current transition-all duration-300 ease-in-out before:absolute before:h-0.5 before:w-full before:rotate-45 before:bg-current before:opacity-0 before:transition-all before:duration-300 before:ease-in-out after:absolute after:h-0.5 after:w-full after:-rotate-45 after:bg-current after:opacity-0 after:transition-all after:duration-300 after:ease-in-out"
        :class="[
          props.getMarkClass(subtask.id, props.index),
          { 'cursor-not-allowed': props.day > store.today },
        ]"
        @click="props.handleMarkClick(subtask.id, props.index, $event)"
        @contextmenu.prevent="props.handleMarkClick(subtask.id, props.index, $event)"
        @touchstart="props.handleTouchStart(subtask.id, props.index)"
        @touchend="props.handleTouchEnd(subtask.id, props.index)"
        @touchcancel="props.handleTouchEnd(subtask.id, props.index)"
      ></div>
    </template>
  </div>
  <div
    v-if="props.isEndOfWeek(props.day)"
    class="h-4 border-1 bg-current"
    :class="{ 'opacity-50': props.day > store.today }"
  ></div>
</template>
