<script setup>
import { useHabitStore } from './stores/habitStore'
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { VueDraggableNext } from 'vue-draggable-next'
import { Plus, Trash2, Eraser, XCircle, Download, Upload, Settings, X, GripVertical, ArrowBigLeft, ArrowBigRight, Printer } from 'lucide-vue-next'

const store = useHabitStore()
const days = computed(() => Array.from({ length: store.daysInMonth }, (_, i) => i + 1))
const editingTitle = ref('')
const editInput = ref(null)
const importInput = ref(null)
const settingsOpen = ref(false)
const menuOpen = ref(false)
const longPressTimer = ref(null)
const { t, locale } = useI18n()
const lang = ref(store.lang)

/**
 * Возвращает состояние круга в заголовке (день).
 */
const getHeaderCircleState = (day) => {
  if (day > store.today) return 'future'
  return 'completed'
}

/**
 * Добавляет новую задачу.
 */
const handleAddTask = () => {
  store.addTask()
}

/**
 * Добавляет подзадачу к задаче.
 */
const handleAddSubtask = (taskId) => {
  store.addSubtask(taskId)
}

/**
 * Начинает редактирование задачи.
 */
const startEditingTask = (taskId, title) => {
  if (store.activeMode !== 'delete') {
    store.startEditing(taskId)
    editingTitle.value = title
    nextTick(() => {
      if (editInput.value) editInput.value.focus()
    })
  }
}

const setEditInput = (el) => {
  if (el) editInput.value = el
}

/**
 * Завершает редактирование задачи (дебаунс).
 */
const finishEditingTask = (taskId) => {
  store.finishEditing(taskId, editingTitle.value)
}

/**
 * Обрабатывает событие blur или Enter для инпута редактирования.
 */
const handleBlurOrEnter = (taskId, event) => {
  if (event.type === 'blur' || event.key === 'Enter') {
    finishEditingTask(taskId)
  }
}

/**
 * Выделяет весь текст в инпуте.
 */
const selectAll = (event) => {
  event.target.select()
}

/**
 * Возвращает CSS-класс для отметки подзадачи.
 */
const getMarkClass = (taskId, subtaskId, dayIndex) => {
  const task = store.tasks.find(t => t.id === taskId)
  if (!task) return 'border-gray-300'
  const subtask = task.subtasks.find(s => s.id === subtaskId)
  if (!subtask || dayIndex >= store.today) return 'cursor-not-allowed'
  const mark = subtask.marks[dayIndex]
  if (mark === true) return 'bg-black cursor-pointer'
  if (mark === false) return 'before:opacity-100 after:opacity-100 cursor-pointer'
  return 'border-black cursor-pointer'
}

/**
 * Обрабатывает клик по отметке.
 */
const handleMarkClick = (taskId, subtaskId, dayIndex, event) => {
  if (dayIndex >= store.today) return
  if (store.activeMode === 'eraser') {
    store.eraseMark(taskId, subtaskId, dayIndex)
  } else if (event.type === 'touchend' && longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    store.handleLongPress(taskId, subtaskId, dayIndex)
  } else {
    const isRightClick = event.button === 2 || (event.type === 'touchend' && !longPressTimer.value)
    store.updateMark(taskId, subtaskId, dayIndex, isRightClick ? false : true)
  }
}

/**
 * Обрабатывает клик по заголовку дня.
 */
const handleHeaderClick = (dayIndex, event) => {
  if (dayIndex >= store.today) return
  const isRightClick = event.button === 2
  store.updateHeaderDay(dayIndex, isRightClick ? false : null)
}

/**
 * Обрабатывает нажатие клавиши Escape.
 */
const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    store.activeMode = null
    settingsOpen.value = false
    menuOpen.value = false
  }
}

/**
 * Открывает диалог импорта.
 */
const handleImport = () => {
  importInput.value.click()
}

/**
 * Проверка возможности перехода к следующему месяцу.
 */
const canNextMonth = computed(() => {
  const newDate = new Date(store.currentDate)
  newDate.setMonth(store.currentMonth + 1)
  const newMonthKey = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
  const realMonthKey = `${store.realDate.getFullYear()}-${String(store.realDate.getMonth() + 1).padStart(2, '0')}`
  return newMonthKey <= realMonthKey
})

/**
 * Обработка долгого нажатия (touch).
 */
const handleTouchStart = (taskId, subtaskId, dayIndex) => {
  if (dayIndex < store.today) {
    longPressTimer.value = setTimeout(() => {
      store.handleLongPress(taskId, subtaskId, dayIndex)
    }, 500)
  }
}

const handleTouchEnd = (taskId, subtaskId, dayIndex) => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
    handleMarkClick(taskId, subtaskId, dayIndex, { type: 'touchend' })
  }
}

/**
 * Определяет текущую тему.
 */
const currentTheme = computed(() => {
  if (store.theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return store.theme
})

/**
 * Изменяет язык приложения.
 */
const changeLang = () => {
  store.setLang(lang.value)
  const systemLang = navigator.language.startsWith('ru') ? 'ru' : 'en'
  locale.value = lang.value === 'system' ? systemLang : lang.value
}

/**
 * Открывает окно печати.
 */
const handlePrint = () => {
  window.print()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div id="app" :class="currentTheme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'">
    <div class="w-fit my-5 mx-auto relative flex flex-col gap-2.5">
      <!-- Настройки -->
      <transition name="fade" mode="out-in">
        <div v-if="settingsOpen" class="hide-print absolute top-0 right-0 p-4 z-50 w-fit border-3" :class="currentTheme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-black'">
          <button @click="settingsOpen = !settingsOpen" class="absolute top-2 right-2 cursor-pointer" :aria-label="t('settings.close')">
            <X class="w-5 h-5" />
          </button>
          <h3 class="text-lg font-semibold mb-2">{{ t('settings.title') }}</h3>
          <div class="grid grid-cols-[repeat(2,1fr)] gap-2.5">
            <div class="flex flex-col gap-1.5">
              <label class="block">{{ t('settings.theme.title') }}</label>
              <select v-model="store.theme" @change="store.setTheme(store.theme)" class="border-2 p-1 w-full">
                <option value="system">{{ t('settings.asInSystem') }}</option>
                <option value="light">{{ t('settings.theme.light') }}</option>
                <option value="dark">{{ t('settings.theme.dark') }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="block">{{ t('settings.lang.title') }}</label>
              <select v-model="lang" @change="changeLang" class="border-2 p-1 w-full">
                <option value="system">{{ t('settings.asInSystem') }}</option>
                <option value="ru">{{ t('settings.lang.russian') }}</option>
                <option value="en">{{ t('settings.lang.english') }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="block">{{ t('settings.expImp.title') }}</label>
              <div class="flex items-center gap-1.5">
                <button @click="store.exportData" class="border-green-500 text-green-500 relative flex justify-center items-center h-8 px-1.5 cursor-pointer border-2">
                  <Upload class="w-5" />
                </button>
                <button @click="handleImport" class="border-purple-500 text-purple-500 relative flex justify-center items-center h-8 px-1.5 cursor-pointer border-2">
                  <Download class="w-5" />
                </button>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="block">{{ t('settings.print.title') }}</label>
              <div class="flex items-center gap-1.5">
                <button @click="handlePrint" class="relative flex justify-center items-center h-8 px-1.5 cursor-pointer border-2">
                  <Printer class="w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
      <!-- Блок текущей даты и управления -->
      <div class="flex items-center gap-4 select-none">
        <h1 class="flex-auto flex items-center gap-1.5">
          <button @click="store.prevMonth" class="hide-print relative flex justify-center items-center h-8 px-1.5 border-2 cursor-pointer" :aria-label="t('control.prevMonth')">
            <ArrowBigLeft class="w-5" />
          </button>
          <button @click="store.nextMonth" :disabled="!canNextMonth" class="hide-print relative flex justify-center items-center h-8 px-1.5 border-2 transition-all duration-300 ease-in-out" :class="canNextMonth ? 'cursor-pointer' : 'opacity-25 cursor-not-allowed'" aria-label="t('control.nextMonth')">
            <ArrowBigRight class="w-5" />
          </button>
          <div class="flex items-center">
            <span class="flex justify-center items-center w-fit h-8 font-semibold italic py-1.5 px-3 self-start cursor-default border-2 -mr-0.5">{{ store.monthName }}</span>
            <span class="flex justify-center items-center w-fit h-8 font-semibold italic py-1.5 px-3 self-start cursor-default border-2">{{ store.currentYear }}</span>
          </div>
        </h1>
        <div class="hide-print flex items-center gap-1.5">
          <div class="flex items-center">
            <p class="flex justify-center items-center w-fit h-8 font-semibold italic py-1.5 px-3 self-start cursor-default border-2 -mr-0.5">{{ t('general.allAveragePer') }}</p>
            <p class="flex justify-center items-center w-fit h-8 font-semibold italic py-1.5 px-3 self-start cursor-default border-2">{{ store.overallProgress }}%</p>
          </div>
          <div class="flex items-center">
            <p class="flex justify-center items-center w-fit h-8 font-semibold italic py-1.5 px-3 self-start cursor-default border-2 -mr-0.5">{{ t('general.grade') }}</p>
            <p class="flex justify-center items-center w-fit h-8 font-semibold italic py-1.5 px-3 self-start cursor-default border-2">{{ store.overallGrade }}</p>
          </div>
        </div>
        <!-- Кнопки управления -->
        <div class="hide-print flex items-center gap-2">
          <div v-if="menuOpen" class="grid grid-cols-2 gap-2">
            <button @click="handleAddTask" class="bg-blue-500 text-white px-3 py-2 rounded flex items-center w-full">
              <Plus class="w-5 mr-2" /> {{ t('control.newTask') }}
            </button>
            <button @click="store.toggleMode('eraser')" :class="{ 'bg-yellow-500': store.activeMode === 'eraser', 'bg-blue-500': store.activeMode !== 'eraser' }" class="text-white px-3 py-2 rounded flex items-center w-full">
              <Eraser class="w-5 mr-2" /> {{ t('control.erase') }}
            </button>
            <button @click="store.toggleMode('delete')" :class="{ 'bg-red-500': store.activeMode === 'delete', 'bg-blue-500': store.activeMode !== 'delete' }" class="text-white px-3 py-2 rounded flex items-center w-full">
              <Trash2 class="w-5 mr-2" /> {{ t('control.deleteTask') }}
            </button>
            <button @click="settingsOpen = !settingsOpen" class="bg-gray-500 text-white px-3 py-2 rounded flex items-center w-full">
              <Settings class="w-5 mr-2" /> {{ t('settings.title') }}
            </button>
            <button @click="menuOpen = false" class="bg-red-500 text-white px-3 py-2 rounded flex items-center w-full">
              {{ t('control.hideControl') }}
            </button>
          </div>
          <button v-else @click="menuOpen = true" class="bg-blue-500 text-white px-4 py-2 rounded flex items-center md:hidden">
            <Plus class="w-5" /> {{ t('control.title') }}
          </button>
          <div v-if="!menuOpen" class="hidden md:flex gap-1.5">
            <button @click="store.toggleMode('eraser')" :class="store.activeMode === 'eraser' ? 'bg-yellow-500 text-white' : 'text-yellow-500'" class="relative flex justify-center items-center h-8 px-1.5 cursor-pointer border-2 border-yellow-500 transition-all duration-300 ease-in-out">
              <Eraser class="w-5" />
            </button>
            <button @click="store.toggleMode('delete')" :class="store.activeMode === 'delete' ? 'bg-red-500 text-white' : 'text-red-500'" class="relative flex justify-center items-center h-8 px-1.5 cursor-pointer border-2 border-red-500 transition-all duration-300 ease-in-out">
              <Trash2 class="w-5" />
            </button>
            <button @click="handleAddTask" class="relative flex justify-center items-center h-8 px-1.5 cursor-pointer border-2">
              <Plus class="w-5" />
            </button>
            <button @click="settingsOpen = !settingsOpen" class="relative flex justify-center items-center h-8 px-1.5 cursor-pointer border-2">
              <Settings class="w-5" />
            </button>
          </div>
        </div>
      </div>
      <!-- Таблица привычек -->
      <div class="overflow-x-auto">
        <div class="border-3 select-none">
          <div class="relative flex flex-col items-center gap-2.5 p-5 min-w-[920px]">
            <div class="flex gap-2">
              <div v-for="day in days" :key="day" class="w-5 flex flex-col items-center gap-[5px] transition-all duration-300 ease-in-out" :class="{ 'opacity-50': getHeaderCircleState(day) === 'future' }">
                <p class="text-[18px] font-medium">{{ day }}</p>
                <div class="relative flex justify-center items-center w-3 h-3 rounded-[50%] border-2 transition-all duration-300 ease-in-out after:absolute after:w-full after:h-0.5 after:bg-black after:-rotate-45 after:opacity-0 after:transition-all after:duration-300 after:ease-in-out before:absolute before:w-full before:h-0.5 before:bg-black before:rotate-45 before:opacity-0 before:transition-all before:duration-300 before:ease-in-out" :class="{
                  'cursor-not-allowed': getHeaderCircleState(day) === 'future',
                  'bg-black cursor-pointer': getHeaderCircleState(day) === 'completed',
                  'bg-transparent before:opacity-100 after:opacity-100': store.tasks.length > 0 && store.tasks.every(t => t.subtasks.every(s => s.marks[day - 1] === false))
                }" @click="handleHeaderClick(day - 1, $event)" @contextmenu.prevent="handleHeaderClick(day - 1, $event)">
                </div>
              </div>
            </div>
          </div>
          <VueDraggableNext v-model="store.tasks" item-key="id" handle=".drag-handle" @end="store.saveState">
            <template v-for="task in store.tasks" :key="task.id">
              <div class="relative flex flex-col items-center gap-2.5 pt-2.5 px-5 pb-[15px] border-t-3">
                <div class="hide-print absolute top-1.5 right-[5px] font-bold text-[12px]" :rowspan="task.subtasks.length">
                  {{ task.progress }}%
                </div>
                <div class="hide-print absolute top-1.5 left-[5px] flex gap-1">
                  <button @click="handleAddSubtask(task.id)" class="relative flex justify-center items-center h-6 px-0.5 border-2 transition-all duration-300 ease-in-out" :class="{
                    'cursor-pointer': task.subtasks.length < 8,
                    'opacity-25 cursor-not-allowed': task.subtasks.length >= 8
                  }">
                    <Plus class="w-4 h-4" />
                  </button>
                  <transition name="fade" mode="out-in">
                    <button v-if="task.subtasks.length > 1" @click="store.deleteLastSubtask(task.id)" class="relative flex justify-center items-center h-6 px-0.5 border-2 cursor-pointer">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </transition>
                </div>
                <div class="relative flex items-center" :rowspan="task.subtasks.length">
                  <span v-if="store.editingTaskId !== task.id" @click="startEditingTask(task.id, task.title)" class="text-[18px] font-bold cursor-text">
                    {{ task.title }}
                  </span>
                  <input v-if="store.editingTaskId === task.id" :ref="setEditInput" v-model="editingTitle" @blur="finishEditingTask(task.id)" @keyup="handleBlurOrEnter(task.id, $event)" @focus="selectAll" class="border-2 p-1 w-full text-sm sm:text-base" />
                  <transition mode="out-in" enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-1">
                    <div key="normal" v-if="store.activeMode !== 'delete'" class="hide-print drag-handle relative inline-flex justify-center items-center w-5 ml-1 cursor-move">
                      <GripVertical class="absolute w-4" />
                    </div>
                    <button key="delete" v-else @click="store.deleteTask(task.id)" class="hide-print relative inline-flex justify-center items-center w-5 ml-1 cursor-pointer">
                      <XCircle class="absolute w-5" />
                    </button>
                  </transition>
                </div>
                <div class="flex gap-2">
                  <div v-for="(day, index) in days" :key="day" class="w-5 flex flex-col items-center gap-[5px] transition-all duration-300 ease-in-out" :class="{ 'opacity-50': day > store.today }">
                    <p class="text-[18px] font-medium">{{ day }}</p>
                    <template v-for="subtask in task.subtasks" :key="subtask.id">
                      <div class="relative flex justify-center items-center w-3 h-3 rounded-[50%] border-2 transition-all duration-300 ease-in-out after:absolute after:w-full after:h-0.5 after:bg-black after:-rotate-45 after:opacity-0 after:transition-all after:duration-300 after:ease-in-out before:absolute before:w-full before:h-0.5 before:bg-black before:rotate-45 before:opacity-0 before:transition-all before:duration-300 before:ease-in-out" @click="handleMarkClick(task.id, subtask.id, index, $event)" @contextmenu.prevent="handleMarkClick(task.id, subtask.id, index, $event)" @touchstart="handleTouchStart(task.id, subtask.id, index)" @touchend="handleTouchEnd(task.id, subtask.id, index)" @touchcancel="handleTouchEnd(task.id, subtask.id, index)" :class="[getMarkClass(task.id, subtask.id, index), { 'cursor-not-allowed': day > store.today }]">
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </VueDraggableNext>
        </div>
      </div>
      <input type="file" ref="importInput" @change="store.importData" style="display: none" accept=".json">
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