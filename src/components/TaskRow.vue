<script setup>
  import { ref, nextTick } from 'vue';
  import { useHabitUtils } from '../composables/useHabitUtils';
  import { useHabitStore } from '../stores/habitStore';
  import { useI18n } from 'vue-i18n';
  import { Plus, Trash2, XCircle, GripVertical } from 'lucide-vue-next';
  import TaskDay from './TaskDay.vue';

  const props = defineProps({
    /** Объект задачи */
    task: {
      type: Object,
      required: true,
    },
  });

  const store = useHabitStore();
  const { isEndOfWeek, monthDays } = useHabitUtils();
  const { t } = useI18n();

  /** Текст редактируемого заголовка задачи */
  const editingTitle = ref('');

  /** Ссылка на input редактирования */
  const editInput = ref(null);

  /** Таймер для обработки долгого нажатия */
  const longPressTimer = ref(null);

  /** Запускает режим редактирования заголовка задачи */
  const startEditingTask = () => {
    if (store.activeMode !== 'delete') {
      store.startEditing(props.task.id);
      editingTitle.value = props.task.title;
      nextTick(() => {
        if (editInput.value) editInput.value.focus();
      });
    }
  };

  /** Устанавливает ссылку на input редактирования */
  const setEditInput = el => {
    if (el) editInput.value = el;
  };

  /** Завершает редактирование заголовка задачи */
  const finishEditingTask = () => {
    store.finishEditing(props.task.id, editingTitle.value);
  };

  /** Обрабатывает blur или Enter в поле редактирования */
  const handleBlurOrEnter = event => {
    if (event.type === 'blur' || event.key === 'Enter') {
      finishEditingTask();
    }
  };

  /** Выделяет весь текст в input при получении фокуса */
  const selectAll = event => {
    event.target.select();
  };

  /** Возвращает CSS-классы для отметки подзадачи в конкретный день */
  const getMarkClass = (subtaskId, dayIndex) => {
    const subtask = props.task.subtasks.find(s => s.id === subtaskId);
    if (!subtask || dayIndex >= store.today) return 'cursor-not-allowed';
    const mark = subtask.marks[dayIndex];
    if (mark === true) return 'bg-current cursor-pointer';
    if (mark === false) return 'before:opacity-100 after:opacity-100 cursor-pointer';
    return 'cursor-pointer';
  };

  /** Обрабатывает клик по отметке дня */
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

  /** Запускает таймер долгого нажатия (touch) */
  const handleTouchStart = (subtaskId, dayIndex) => {
    if (dayIndex < store.today) {
      longPressTimer.value = setTimeout(() => {
        store.handleLongPress(props.task.id, subtaskId, dayIndex);
      }, 500);
    }
  };

  /** Очищает таймер и, при необходимости, обрабатывает обычный клик */
  const handleTouchEnd = (subtaskId, dayIndex) => {
    if (longPressTimer.value) {
      clearTimeout(longPressTimer.value);
      longPressTimer.value = null;
      handleMarkClick(subtaskId, dayIndex, { type: 'touchend' });
    }
  };

  /** Добавляет новую подзадачу к текущей задаче */
  const handleAddSubtask = () => {
    store.addSubtask(props.task.id);
  };
</script>

<template>
  <div class="relative flex flex-col items-center gap-2.5 border-t-3 px-5 pt-2.5 pb-[15px]">
    <!-- Процент выполнения задачи -->
    <div class="hide-print absolute top-1.5 right-[5px] text-[12px] font-bold">
      {{ task.progress }}%
    </div>

    <!-- Кнопки добавления/удаления подзадач -->
    <div class="hide-print absolute top-1.5 left-[5px] flex gap-1">
      <button
        class="relative flex h-6 items-center justify-center border-2 px-0.5 transition-all duration-300 ease-in-out"
        :class="{
          'cursor-pointer': task.subtasks.length < 8,
          'cursor-not-allowed opacity-25': task.subtasks.length >= 8,
        }"
        @click="handleAddSubtask"
        :title="t('control.newSubtask')"
      >
        <Plus class="h-4 w-4" />
      </button>

      <transition name="fade" mode="out-in">
        <button
          v-if="task.subtasks.length > 1"
          class="relative flex h-6 cursor-pointer items-center justify-center border-2 px-0.5"
          @click="store.deleteLastSubtask(task.id)"
          :title="t('control.deleteSubtask')"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </transition>
    </div>

    <!-- Заголовок задачи -->
    <div class="relative flex items-center">
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

      <!-- Перемещение / удаление задачи -->
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
          :title="t('control.moveTask')"
        >
          <GripVertical class="absolute w-4" />
        </div>

        <button
          v-else
          key="delete"
          class="hide-print relative ml-1 inline-flex w-5 cursor-pointer items-center justify-center"
          @click="store.deleteTask(task.id)"
          :title="t('control.deleteTask')"
        >
          <XCircle class="absolute w-5" />
        </button>
      </transition>
    </div>

    <!-- Дни месяца с отметками подзадач -->
    <div class="flex items-end-safe gap-2">
      <TaskDay
        v-for="(day, index) in monthDays"
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
