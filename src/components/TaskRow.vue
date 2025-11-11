<script setup>
  import { ref, nextTick } from 'vue';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useHabitStore } from '@/stores/habitStore';
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

  /** Таймер и состояние для двойного тапа */
  const tapState = ref(new Map());
  const DOUBLE_TAP_DELAY = 250;
  const getTapKey = (taskId, subtaskId, dayIndex) => `${taskId}-${subtaskId}-${dayIndex}`;

  /** Общий обработчик тапа */
  const handleTap = (subtaskId, dayIndex, event) => {
    const taskId = props.task.id;
    if (dayIndex >= store.today) return;

    const key = getTapKey(taskId, subtaskId, dayIndex);
    const now = Date.now();

    let state = tapState.value.get(key) || { lastTap: 0, timeout: null };

    if (state.timeout) {
      clearTimeout(state.timeout);
      state.timeout = null;
    }

    const timeDiff = now - state.lastTap;

    if (timeDiff < DOUBLE_TAP_DELAY && timeDiff > 0) {
      if (store.activeMode === 'eraser') {
        store.eraseMark(taskId, subtaskId, dayIndex);
      } else {
        store.updateMark(taskId, subtaskId, dayIndex, false);
      }
      tapState.value.delete(key);
    } else {
      state.lastTap = now;
      state.timeout = setTimeout(() => {
        if (store.activeMode === 'eraser') {
          store.eraseMark(taskId, subtaskId, dayIndex);
        } else {
          store.updateMark(taskId, subtaskId, dayIndex, true);
        }
        tapState.value.delete(key);
      }, DOUBLE_TAP_DELAY);

      tapState.value.set(key, state);
    }

    event.preventDefault();
  };

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
    } else {
      const isRightClick = event.button === 2;
      store.updateMark(props.task.id, subtaskId, dayIndex, isRightClick ? false : true);
    }
  };

  /** Добавляет новую подзадачу к текущей задаче */
  const handleAddSubtask = () => {
    store.addSubtask(props.task.id);
  };
</script>

<template>
  <div
    class="relative flex flex-col gap-2.5 border-t-3 px-2 pt-2.5 pb-[15px] md:items-center md:px-5 print:items-center print:px-5"
  >
    <div
      class="max-md:not-print:sticky max-md:not-print:left-2 max-md:not-print:flex max-md:not-print:w-[calc(100vw-16px)] max-md:not-print:items-center max-md:not-print:gap-3"
    >
      <!-- Заголовок задачи -->
      <div class="relative flex items-center max-md:not-print:flex-1">
        <span
          v-if="store.editingTaskId !== task.id"
          class="cursor-text text-sm leading-none font-bold md:text-lg print:text-lg"
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
            class="tap-highlight-transparent hide-print relative ml-1 inline-flex w-5 cursor-pointer touch-manipulation items-center justify-center"
            @click="store.deleteTask(task.id)"
            :title="t('control.deleteTask')"
          >
            <XCircle class="absolute w-5" />
          </button>
        </transition>
      </div>

      <!-- Процент выполнения задачи -->
      <div class="hide-print top-1.5 right-[5px] text-[12px] font-bold md:absolute print:absolute">
        {{ task.progress }}%
      </div>

      <!-- Кнопки добавления/удаления подзадач -->
      <div
        class="hide-print top-1.5 left-[5px] flex gap-1 max-md:not-print:flex-row-reverse md:absolute print:absolute"
      >
        <button
          class="tap-highlight-transparent relative flex h-6 touch-manipulation items-center justify-center border-2 px-0.5 transition-all duration-300 ease-in-out"
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
            class="tap-highlight-transparent relative flex h-6 cursor-pointer touch-manipulation items-center justify-center border-2 px-0.5"
            @click="store.deleteLastSubtask(task.id)"
            :title="t('control.deleteSubtask')"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </transition>
      </div>
    </div>

    <!-- Дни месяца с отметками подзадач -->
    <div class="flex items-end-safe justify-center gap-0.5 md:gap-2 print:gap-2">
      <TaskDay
        v-for="(day, index) in monthDays"
        :key="day"
        :day="day"
        :index="index"
        :task="task"
        :getMarkClass="getMarkClass"
        :handleMarkClick="handleMarkClick"
        :handleTap="handleTap"
        :isEndOfWeek="d => isEndOfWeek(d, index === monthDays.length - 1)"
      />
    </div>
  </div>
</template>
