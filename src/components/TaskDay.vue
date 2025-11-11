<script setup>
  import { useHabitStore } from '@/stores/habitStore';

  const props = defineProps({
    /** Номер дня в месяце */
    day: Number,
    /** Индекс дня (day-1) */
    index: Number,
    /** Объект задачи */
    task: Object,
    /** Функция получения CSS-классов для отметки */
    getMarkClass: Function,
    /** Обработчик клика по отметке */
    handleMarkClick: Function,
    /** Обработчик начала долгого нажатия (touch) */
    handleTouchStart: Function,
    /** Обработчик окончания нажатия (touch) */
    handleTouchEnd: Function,
    /** Функция определения конца недели */
    isEndOfWeek: Function,
  });

  const store = useHabitStore();
</script>

<template>
  <div
    class="flex w-5 flex-col items-center gap-[5px] transition-all duration-300 ease-in-out"
    :class="{ 'opacity-50': day > store.today }"
  >
    <p class="text-sm leading-none font-medium md:text-lg print:text-lg">{{ day }}</p>

    <!-- Отметки для каждой подзадачи в этот день -->
    <template v-for="subtask in task.subtasks" :key="subtask.id">
      <div
        class="tap-highlight-transparent relative flex aspect-square w-9/10 touch-manipulation items-center justify-center rounded-[50%] border-2 border-current transition-all duration-300 ease-in-out before:absolute before:h-0.5 before:w-full before:rotate-45 before:bg-current before:opacity-0 before:transition-all before:duration-300 before:ease-in-out after:absolute after:h-0.5 after:w-full after:-rotate-45 after:bg-current after:opacity-0 after:transition-all after:duration-300 after:ease-in-out md:w-3 print:w-3"
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

  <!-- Вертикальный разделитель конца недели -->
  <div
    v-if="props.isEndOfWeek(props.day)"
    class="h-3 border-1 bg-current md:h-4 print:h-4"
    :class="{ 'opacity-50': props.day > store.today }"
  ></div>
</template>
