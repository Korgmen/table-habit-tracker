<!-- src/components/TaskRow.vue -->
<script setup>
  import { ref, computed, nextTick } from 'vue';
  import { useHabitStore } from '../stores/habitStore';
  import { Plus, Trash2, XCircle, GripVertical } from 'lucide-vue-next';
  import TaskDay from './TaskDay.vue';

  const props = defineProps({
    task: {
      type: Object,
      required: true,
    },
  });

  const store = useHabitStore();
  const days = computed(() => Array.from({ length: store.daysInMonth }, (_, i) => i + 1));
  const weekEndDay = computed(() => (store.weekStart === 'monday' ? 0 : 6));
  const editingTitle = ref('');
  const editInput = ref(null);
  const longPressTimer = ref(null);

  /**
   * Проверяет, является ли день концом недели.
   */
  const isEndOfWeek = day => {
    const date = new Date(store.currentYear, store.currentMonth, day);
    return store.showWeekSeparators && date.getDay() === weekEndDay.value;
  };

  /**
   * Начинает редактирование задачи.
   */
  const startEditingTask = () => {
    if (store.activeMode !== 'delete') {
      store.startEditing(props.task.id);
      editingTitle.value = props.task.title;
      nextTick(() => {
        if (editInput.value) editInput.value.focus();
      });
    }
  };

  const setEditInput = el => {
    if (el) editInput.value = el;
  };

  /**
   * Завершает редактирование задачи.
   */
  const finishEditingTask = () => {
    store.finishEditing(props.task.id, editingTitle.value);
  };

  /**
   * Обрабатывает событие blur или Enter для инпута редактирования.
   */
  const handleBlurOrEnter = event => {
    if (event.type === 'blur' || event.key === 'Enter') {
      finishEditingTask();
    }
  };

  /**
   * Выделяет весь текст в инпуте.
   */
  const selectAll = event => {
    event.target.select();
  };

  /**
   * Возвращает CSS-класс для отметки подзадачи.
   */
  const getMarkClass = (subtaskId, dayIndex) => {
    const subtask = props.task.subtasks.find(s => s.id === subtaskId);
    if (!subtask || dayIndex >= store.today) return 'cursor-not-allowed';
    const mark = subtask.marks[dayIndex];
    if (mark === true) return 'bg-current cursor-pointer';
    if (mark === false) return 'before:opacity-100 after:opacity-100 cursor-pointer';
    return 'cursor-pointer';
  };

  /**
   * Обрабатывает клик по отметке.
   */
  const handleMarkClick = (subtaskId, dayIndex, event) => {
    if (dayIndex >= store.today) return;
    if (store.activeMode === 'eraser') {
      store.eraseMark(props.task.id, subtaskId, dayIndex);
    } else if (event.type === 'touchend' && longPressTimer.value) {
      clearTimeout(longPressTimer.value);
      store.handleLongPress(props.task.id, subtaskId, dayIndex);
    } else {
      const isRightClick =
        event.button === 2 || (event.type === 'touchend' && !longPressTimer.value);
      store.updateMark(props.task.id, subtaskId, dayIndex, isRightClick ? false : true);
    }
  };

  /**
   * Обработка долгого нажатия (touch start).
   */
  const handleTouchStart = (subtaskId, dayIndex) => {
    if (dayIndex < store.today) {
      longPressTimer.value = setTimeout(() => {
        store.handleLongPress(props.task.id, subtaskId, dayIndex);
      }, 500);
    }
  };

  /**
   * Обработка конца touch.
   */
  const handleTouchEnd = (subtaskId, dayIndex) => {
    if (longPressTimer.value) {
      clearTimeout(longPressTimer.value);
      longPressTimer.value = null;
      handleMarkClick(subtaskId, dayIndex, { type: 'touchend' });
    }
  };

  /**
   * Добавляет подзадачу.
   */
  const handleAddSubtask = () => {
    store.addSubtask(props.task.id);
  };
</script>

<template>
  <div class="relative flex flex-col items-center gap-2.5 border-t-3 px-5 pt-2.5 pb-[15px]">
    <div
      class="hide-print absolute top-1.5 right-[5px] text-[12px] font-bold"
      :rowspan="task.subtasks.length"
    >
      {{ task.progress }}%
    </div>
    <div class="hide-print absolute top-1.5 left-[5px] flex gap-1">
      <button
        class="relative flex h-6 items-center justify-center border-2 px-0.5 transition-all duration-300 ease-in-out"
        :class="{
          'cursor-pointer': task.subtasks.length < 8,
          'cursor-not-allowed opacity-25': task.subtasks.length >= 8,
        }"
        @click="handleAddSubtask"
      >
        <Plus class="h-4 w-4" />
      </button>
      <transition name="fade" mode="out-in">
        <button
          v-if="task.subtasks.length > 1"
          class="relative flex h-6 cursor-pointer items-center justify-center border-2 px-0.5"
          @click="store.deleteLastSubtask(task.id)"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </transition>
    </div>
    <div class="relative flex items-center" :rowspan="task.subtasks.length">
      <span
        v-if="store.editingTaskId !== task.id"
        class="cursor-text text-[18px] font-bold"
        @click="startEditingTask"
      >
        {{ task.title }}
      </span>
      <input
        v-if="store.editingTaskId === task.id"
        :ref="setEditInput"
        v-model="editingTitle"
        class="w-full border-2 p-1 text-sm sm:text-base"
        @blur="finishEditingTask"
        @keyup="handleBlurOrEnter"
        @focus="selectAll"
      />
      <transition
        mode="out-in"
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="store.activeMode !== 'delete'"
          key="normal"
          class="hide-print drag-handle relative ml-1 inline-flex w-5 cursor-move items-center justify-center"
        >
          <GripVertical class="absolute w-4" />
        </div>
        <button
          v-else
          key="delete"
          class="hide-print relative ml-1 inline-flex w-5 cursor-pointer items-center justify-center"
          @click="store.deleteTask(task.id)"
        >
          <XCircle class="absolute w-5" />
        </button>
      </transition>
    </div>
    <div class="flex items-end-safe gap-2">
      <TaskDay
        v-for="(day, index) in days"
        :key="day"
        :day="day"
        :index="index"
        :task="task"
        :getMarkClass="getMarkClass"
        :handleMarkClick="handleMarkClick"
        :handleTouchStart="handleTouchStart"
        :handleTouchEnd="handleTouchEnd"
        :isEndOfWeek="isEndOfWeek"
      />
    </div>
  </div>
</template>
