<script setup>
  import { useHabitStore } from './stores/habitStore';
  import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { VueDraggableNext } from 'vue-draggable-next';
  import {
    Plus,
    Trash2,
    Eraser,
    XCircle,
    Download,
    Upload,
    Settings,
    X,
    GripVertical,
    ArrowBigLeft,
    ArrowBigRight,
    Printer,
  } from 'lucide-vue-next';

  const store = useHabitStore();
  const days = computed(() => Array.from({ length: store.daysInMonth }, (_, i) => i + 1));
  const weekEndDay = computed(() => (store.weekStart === 'monday' ? 0 : 6));
  const editingTitle = ref('');
  const editInput = ref(null);
  const importInput = ref(null);
  const settingsOpen = ref(false);
  const menuOpen = ref(false);
  const longPressTimer = ref(null);
  const { t, locale } = useI18n();
  const lang = ref(store.lang);

  /**
   * Возвращает состояние круга в заголовке (день).
   */
  const getHeaderCircleState = day => {
    if (day > store.today) return 'future';
    return 'completed';
  };

  /**
   * Проверяет, является ли день концом недели.
   */
  const isEndOfWeek = day => {
    const date = new Date(store.currentYear, store.currentMonth, day);
    return store.showWeekSeparators && date.getDay() === weekEndDay.value;
  };

  /**
   * Добавляет новую задачу.
   */
  const handleAddTask = () => {
    store.addTask();
  };

  /**
   * Добавляет подзадачу к задаче.
   */
  const handleAddSubtask = taskId => {
    store.addSubtask(taskId);
  };

  /**
   * Начинает редактирование задачи.
   */
  const startEditingTask = (taskId, title) => {
    if (store.activeMode !== 'delete') {
      store.startEditing(taskId);
      editingTitle.value = title;
      nextTick(() => {
        if (editInput.value) editInput.value.focus();
      });
    }
  };

  const setEditInput = el => {
    if (el) editInput.value = el;
  };

  /**
   * Завершает редактирование задачи (дебаунс).
   */
  const finishEditingTask = taskId => {
    store.finishEditing(taskId, editingTitle.value);
  };

  /**
   * Обрабатывает событие blur или Enter для инпута редактирования.
   */
  const handleBlurOrEnter = (taskId, event) => {
    if (event.type === 'blur' || event.key === 'Enter') {
      finishEditingTask(taskId);
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
  const getMarkClass = (taskId, subtaskId, dayIndex) => {
    const task = store.tasks.find(t => t.id === taskId);
    if (!task) return 'border-gray-300';
    const subtask = task.subtasks.find(s => s.id === subtaskId);
    if (!subtask || dayIndex >= store.today) return 'cursor-not-allowed';
    const mark = subtask.marks[dayIndex];
    if (mark === true) return 'bg-current cursor-pointer';
    if (mark === false) return 'before:opacity-100 after:opacity-100 cursor-pointer';
    return 'cursor-pointer';
  };

  /**
   * Обрабатывает клик по отметке.
   */
  const handleMarkClick = (taskId, subtaskId, dayIndex, event) => {
    if (dayIndex >= store.today) return;
    if (store.activeMode === 'eraser') {
      store.eraseMark(taskId, subtaskId, dayIndex);
    } else if (event.type === 'touchend' && longPressTimer.value) {
      clearTimeout(longPressTimer.value);
      store.handleLongPress(taskId, subtaskId, dayIndex);
    } else {
      const isRightClick =
        event.button === 2 || (event.type === 'touchend' && !longPressTimer.value);
      store.updateMark(taskId, subtaskId, dayIndex, isRightClick ? false : true);
    }
  };

  /**
   * Обрабатывает клик по заголовку дня.
   */
  const handleHeaderClick = (dayIndex, event) => {
    if (dayIndex >= store.today) return;
    const isRightClick = event.button === 2;
    store.updateHeaderDay(dayIndex, isRightClick ? false : null);
  };

  /**
   * Обрабатывает нажатие клавиш.
   */
  const handleKeydown = event => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

    const keyActions = {
      Escape: () => {
        store.activeMode = null;
        settingsOpen.value = false;
        menuOpen.value = false;
      },
      KeyE: () => {
        store.toggleMode('eraser');
        settingsOpen.value = false;
      },
      KeyD: () => {
        store.toggleMode('delete');
        settingsOpen.value = false;
      },
      KeyN: () => store.addTask(),
      ArrowLeft: () => store.prevMonth(),
      ArrowRight: () => canNextMonth.value && store.nextMonth(),
      KeyS: () => {
        settingsOpen.value = !settingsOpen.value;
        store.activeMode = null;
      },
    };

    keyActions[event.code]?.();
  };

  /**
   * Открывает диалог импорта.
   */
  const handleImport = () => {
    importInput.value.click();
  };

  /**
   * Проверка возможности перехода к следующему месяцу.
   */
  const canNextMonth = computed(() => {
    const newDate = new Date(store.currentDate);
    newDate.setMonth(store.currentMonth + 1);
    const newMonthKey = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    const realMonthKey = `${store.realDate.getFullYear()}-${String(store.realDate.getMonth() + 1).padStart(2, '0')}`;
    return newMonthKey <= realMonthKey;
  });

  /**
   * Обработка долгого нажатия (touch).
   */
  const handleTouchStart = (taskId, subtaskId, dayIndex) => {
    if (dayIndex < store.today) {
      longPressTimer.value = setTimeout(() => {
        store.handleLongPress(taskId, subtaskId, dayIndex);
      }, 500);
    }
  };

  const handleTouchEnd = (taskId, subtaskId, dayIndex) => {
    if (longPressTimer.value) {
      clearTimeout(longPressTimer.value);
      longPressTimer.value = null;
      handleMarkClick(taskId, subtaskId, dayIndex, { type: 'touchend' });
    }
  };

  /**
   * Определяет текущую тему.
   */
  const currentTheme = computed(() => {
    if (store.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return store.theme;
  });

  /**
   * Изменяет язык приложения.
   */
  const changeLang = () => {
    store.setLang(lang.value);
    const systemLang = navigator.language.startsWith('ru') ? 'ru' : 'en';
    locale.value = lang.value === 'system' ? systemLang : lang.value;
  };

  /**
   * Открывает окно печати.
   */
  const handlePrint = () => {
    window.print();
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<template>
  <div
    id="app"
    class="flex min-h-screen justify-center"
    :class="currentTheme === 'dark' ? 'bg-[#292929] text-[#FFF8F0]' : 'bg-white text-[#12130F]'"
  >
    <div class="relative mx-auto my-5 flex w-fit flex-col gap-2.5">
      <!-- Настройки -->
      <transition name="fade" mode="out-in">
        <div
          v-if="settingsOpen"
          class="hide-print absolute top-0 right-0 z-50 w-fit border-3 p-4"
          :class="
            currentTheme === 'dark' ? 'bg-[#292929] text-[#FFF8F0]' : 'bg-white text-[#12130F]'
          "
        >
          <button
            class="absolute top-2 right-2 cursor-pointer"
            :aria-label="t('settings.close')"
            @click="settingsOpen = !settingsOpen"
          >
            <X class="h-5 w-5" />
          </button>
          <div class="flex flex-col gap-5">
            <div class="grid grid-cols-[repeat(2,1fr)] gap-2.5">
              <h3 class="col-span-2 text-lg font-semibold">{{ t('settings.title') }}</h3>
              <div class="flex flex-col gap-1.5">
                <label class="block">{{ t('settings.theme.title') }}</label>
                <select
                  v-model="store.theme"
                  class="w-full border-2 p-1"
                  @change="store.setTheme(store.theme)"
                >
                  <option value="system">{{ t('settings.asInSystem') }}</option>
                  <option value="light">{{ t('settings.theme.light') }}</option>
                  <option value="dark">{{ t('settings.theme.dark') }}</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="block">{{ t('settings.lang.title') }}</label>
                <select v-model="lang" class="w-full border-2 p-1" @change="changeLang">
                  <option value="system">{{ t('settings.asInSystem') }}</option>
                  <option value="ru">{{ t('settings.lang.russian') }}</option>
                  <option value="en">{{ t('settings.lang.english') }}</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="block">{{ t('settings.expImp.title') }}</label>
                <div class="flex items-center gap-1.5">
                  <button
                    class="relative flex h-8 cursor-pointer items-center justify-center border-2 border-green-500 px-1.5 text-green-500"
                    @click="store.exportData"
                  >
                    <Upload class="w-5" />
                  </button>
                  <button
                    class="relative flex h-8 cursor-pointer items-center justify-center border-2 border-purple-500 px-1.5 text-purple-500"
                    @click="handleImport"
                  >
                    <Download class="w-5" />
                  </button>
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="block">{{ t('settings.print.title') }}</label>
                <div class="flex items-center gap-1.5">
                  <button
                    class="relative flex h-8 cursor-pointer items-center justify-center border-2 px-1.5"
                    @click="handlePrint"
                  >
                    <Printer class="w-5" />
                  </button>
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="block">{{ t('settings.showWeek.title') }}</label>
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    v-model="store.showWeekSeparators"
                    @change="store.setShowWeekSeparators(store.showWeekSeparators)"
                  />
                  {{ t('settings.showWeek.checkbox') }}
                </label>
                <div v-if="store.showWeekSeparators" class="mt-1.5 col-span-2 flex flex-col gap-1.5">
                  <label class="block">{{ t('settings.weekStart.title') }}</label>
                  <select
                    v-model="store.weekStart"
                    class="w-full border-2 p-1"
                    @change="store.setWeekStart(store.weekStart)"
                  >
                    <option value="monday">{{ t('settings.weekStart.monday') }}</option>
                    <option value="sunday">{{ t('settings.weekStart.sunday') }}</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-2.5">
              <h3 class="text-lg font-semibold">{{ t('settings.hotkeys.title') }}</h3>
              <div class="flex flex-col gap-1.5">
                <ul class="leading-relaxed">
                  <li>{{ t('settings.hotkeys.escape') }}</li>
                  <li>{{ t('settings.hotkeys.e') }}</li>
                  <li>{{ t('settings.hotkeys.d') }}</li>
                  <li>{{ t('settings.hotkeys.n') }}</li>
                  <li>{{ t('settings.hotkeys.arrowLeft') }}</li>
                  <li>{{ t('settings.hotkeys.arrowRight') }}</li>
                  <li>{{ t('settings.hotkeys.s') }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </transition>
      <!-- Блок текущей даты и управления -->
      <div class="flex items-center gap-4 select-none">
        <h1 class="flex flex-auto items-center gap-1.5">
          <button
            class="hide-print relative flex h-8 cursor-pointer items-center justify-center border-2 px-1.5"
            :aria-label="t('control.prevMonth')"
            @click="store.prevMonth"
          >
            <ArrowBigLeft class="w-5" />
          </button>
          <button
            :disabled="!canNextMonth"
            class="hide-print relative flex h-8 items-center justify-center border-2 px-1.5 transition-all duration-300 ease-in-out"
            :class="canNextMonth ? 'cursor-pointer' : 'cursor-not-allowed opacity-25'"
            aria-label="t('control.nextMonth')"
            @click="store.nextMonth"
          >
            <ArrowBigRight class="w-5" />
          </button>
          <div class="flex items-center">
            <span
              class="-mr-0.5 flex h-8 w-fit cursor-default items-center justify-center self-start border-2 px-3 py-1.5 font-semibold italic"
            >
              {{ store.monthName }}
            </span>
            <span
              class="flex h-8 w-fit cursor-default items-center justify-center self-start border-2 px-3 py-1.5 font-semibold italic"
            >
              {{ store.currentYear }}
            </span>
          </div>
        </h1>
        <div class="hide-print flex items-center gap-1.5">
          <div class="flex items-center">
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
          <div class="flex items-center">
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
        </div>
        <!-- Кнопки управления -->
        <div class="hide-print flex items-center gap-2">
          <div v-if="menuOpen" class="grid grid-cols-2 gap-2">
            <button
              class="flex w-full items-center rounded bg-blue-500 px-3 py-2 text-white"
              @click="handleAddTask"
            >
              <Plus class="mr-2 w-5" />
              {{ t('control.newTask') }}
            </button>
            <button
              :class="{
                'bg-yellow-500': store.activeMode === 'eraser',
                'bg-blue-500': store.activeMode !== 'eraser',
              }"
              class="flex w-full items-center rounded px-3 py-2 text-white"
              @click="store.toggleMode('eraser')"
            >
              <Eraser class="mr-2 w-5" />
              {{ t('control.erase') }}
            </button>
            <button
              :class="{
                'bg-red-500': store.activeMode === 'delete',
                'bg-blue-500': store.activeMode !== 'delete',
              }"
              class="flex w-full items-center rounded px-3 py-2 text-white"
              @click="store.toggleMode('delete')"
            >
              <Trash2 class="mr-2 w-5" />
              {{ t('control.deleteTask') }}
            </button>
            <button
              class="flex w-full items-center rounded bg-gray-500 px-3 py-2 text-white"
              @click="settingsOpen = !settingsOpen"
            >
              <Settings class="mr-2 w-5" />
              {{ t('settings.title') }}
            </button>
            <button
              class="flex w-full items-center rounded bg-red-500 px-3 py-2 text-white"
              @click="menuOpen = false"
            >
              {{ t('control.hideControl') }}
            </button>
          </div>
          <button
            v-else
            class="flex items-center rounded bg-blue-500 px-4 py-2 text-white md:hidden"
            @click="menuOpen = true"
          >
            <Plus class="w-5" />
            {{ t('control.title') }}
          </button>
          <div v-if="!menuOpen" class="hidden gap-1.5 md:flex">
            <button
              :class="
                store.activeMode === 'eraser' ? 'bg-yellow-500 text-white' : 'text-yellow-500'
              "
              class="relative flex h-8 cursor-pointer items-center justify-center border-2 border-yellow-500 px-1.5 transition-all duration-300 ease-in-out"
              @click="store.toggleMode('eraser')"
            >
              <Eraser class="w-5" />
            </button>
            <button
              :class="store.activeMode === 'delete' ? 'bg-red-500 text-white' : 'text-red-500'"
              class="relative flex h-8 cursor-pointer items-center justify-center border-2 border-red-500 px-1.5 transition-all duration-300 ease-in-out"
              @click="store.toggleMode('delete')"
            >
              <Trash2 class="w-5" />
            </button>
            <button
              class="relative flex h-8 cursor-pointer items-center justify-center border-2 px-1.5"
              @click="handleAddTask"
            >
              <Plus class="w-5" />
            </button>
            <button
              class="relative flex h-8 cursor-pointer items-center justify-center border-2 px-1.5"
              @click="settingsOpen = !settingsOpen"
            >
              <Settings class="w-5" />
            </button>
          </div>
        </div>
      </div>
      <!-- Таблица привычек -->
      <div class="overflow-x-auto">
        <div class="border-3 select-none">
          <div class="relative flex min-w-[960px] flex-col items-center gap-2.5 p-5">
            <div class="flex items-end-safe gap-2">
              <template v-for="day in days" :key="day">
                <div
                  class="flex w-5 flex-col items-center gap-[5px] transition-all duration-300 ease-in-out"
                  :class="{ 'opacity-50': getHeaderCircleState(day) === 'future' }"
                >
                  <p class="text-[18px] font-medium">{{ day }}</p>
                  <div
                    class="relative flex h-3 w-3 items-center justify-center rounded-[50%] border-2 transition-all duration-300 ease-in-out before:absolute before:h-0.5 before:w-full before:rotate-45 before:bg-current before:opacity-0 before:transition-all before:duration-300 before:ease-in-out after:absolute after:h-0.5 after:w-full after:-rotate-45 after:bg-current after:opacity-0 after:transition-all after:duration-300 after:ease-in-out"
                    :class="{
                      'cursor-not-allowed': getHeaderCircleState(day) === 'future',
                      'cursor-pointer bg-current': getHeaderCircleState(day) === 'completed',
                      'bg-transparent before:opacity-100 after:opacity-100':
                        store.tasks.length > 0 &&
                        store.tasks.every(t => t.subtasks.every(s => s.marks[day - 1] === false)),
                    }"
                    @click="handleHeaderClick(day - 1, $event)"
                    @contextmenu.prevent="handleHeaderClick(day - 1, $event)"
                  ></div>
                </div>
                <div
                  v-if="isEndOfWeek(day)"
                  class="h-4 border-1 bg-current"
                  :class="{ 'opacity-50': getHeaderCircleState(day) === 'future' }"
                ></div>
              </template>
            </div>
          </div>
          <VueDraggableNext
            v-model="store.tasks"
            item-key="id"
            handle=".drag-handle"
            @end="store.saveState"
          >
            <template v-for="task in store.tasks" :key="task.id">
              <div
                class="relative flex flex-col items-center gap-2.5 border-t-3 px-5 pt-2.5 pb-[15px]"
              >
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
                    @click="handleAddSubtask(task.id)"
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
                    @click="startEditingTask(task.id, task.title)"
                  >
                    {{ task.title }}
                  </span>
                  <input
                    v-if="store.editingTaskId === task.id"
                    :ref="setEditInput"
                    v-model="editingTitle"
                    class="w-full border-2 p-1 text-sm sm:text-base"
                    @blur="finishEditingTask(task.id)"
                    @keyup="handleBlurOrEnter(task.id, $event)"
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
                  <template v-for="(day, index) in days" :key="day">
                    <div
                      class="flex w-5 flex-col items-center gap-[5px] transition-all duration-300 ease-in-out"
                      :class="{ 'opacity-50': day > store.today }"
                    >
                      <p class="text-[18px] font-medium">{{ day }}</p>
                      <template v-for="subtask in task.subtasks" :key="subtask.id">
                        <div
                          class="relative flex h-3 w-3 items-center justify-center rounded-[50%] border-2 border-current transition-all duration-300 ease-in-out before:absolute before:h-0.5 before:w-full before:rotate-45 before:bg-current before:opacity-0 before:transition-all before:duration-300 before:ease-in-out after:absolute after:h-0.5 after:w-full after:-rotate-45 after:bg-current after:opacity-0 after:transition-all after:duration-300 after:ease-in-out"
                          :class="[
                            getMarkClass(task.id, subtask.id, index),
                            { 'cursor-not-allowed': day > store.today },
                          ]"
                          @click="handleMarkClick(task.id, subtask.id, index, $event)"
                          @contextmenu.prevent="handleMarkClick(task.id, subtask.id, index, $event)"
                          @touchstart="handleTouchStart(task.id, subtask.id, index)"
                          @touchend="handleTouchEnd(task.id, subtask.id, index)"
                          @touchcancel="handleTouchEnd(task.id, subtask.id, index)"
                        ></div>
                      </template>
                    </div>
                    <div
                      v-if="isEndOfWeek(day)"
                      class="h-4 border-1 bg-current"
                      :class="{ 'opacity-50': getHeaderCircleState(day) === 'future' }"
                    ></div>
                  </template>
                </div>
              </div>
            </template>
          </VueDraggableNext>
        </div>
      </div>
      <input
        ref="importInput"
        type="file"
        style="display: none"
        accept=".json"
        @change="store.importData"
      />
    </div>
  </div>
</template>

<style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.25s;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }

  .fade-enter-to,
  .fade-leave-from {
    opacity: 1;
  }

  @media print {
    body,
    #app {
      background: white !important;
      color: black !important;
      display: block;
    }

    * {
      opacity: 100% !important;
    }

    /* Скрыть все элементы управления, кроме таблицы и месяца/года */
    .hide-print {
      display: none !important;
    }
  }
</style>
