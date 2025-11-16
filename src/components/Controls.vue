<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { Plus, Trash2, Eraser, Settings, Copy } from 'lucide-vue-next';

  const store = useHabitStore();
  const { t } = useI18n();
  const { showTaskLimit, confirmDuplicateToCurrent } = useModals(t);

  const emit = defineEmits([
    /** Запрос переключения окна настроек */
    'toggle-settings',
  ]);

  /**
   * Проверяет, отображается ли текущий реальный месяц.
   * Если да — кнопка дублирования скрывается.
   */
  const isCurrentMonth = computed(() => {
    return (
      store.currentMonth === store.realDate.getMonth() &&
      store.currentYear === store.realDate.getFullYear()
    );
  });

  /** Проверка: достигнуто ли максимальное количество задач */
  const canAddTask = computed(() => store.tasks.length < 20);

  /** Управляет добавлением задач */
  const tryAddTask = () => {
    if (!store.addTask()) {
      showTaskLimit();
    }
  };
</script>

<template>
  <div class="hide-print flex items-center gap-2">
    <!-- Кнопки управления -->
    <div class="flex gap-1.5">
      <button
        :class="store.activeMode === 'eraser' ? 'bg-yellow-500 text-white' : 'text-yellow-500'"
        class="tap-highlight-transparent relative flex h-8 cursor-pointer touch-manipulation items-center justify-center border-2 border-yellow-500 px-1.5 transition-all duration-300 ease-in-out"
        @click="store.toggleMode('eraser')"
        :title="t('control.eraseMode')"
      >
        <Eraser class="w-5" />
      </button>

      <button
        :class="store.activeMode === 'delete' ? 'bg-red-500 text-white' : 'text-red-500'"
        class="tap-highlight-transparent relative flex h-8 cursor-pointer touch-manipulation items-center justify-center border-2 border-red-500 px-1.5 transition-all duration-300 ease-in-out"
        @click="store.toggleMode('delete')"
        :title="t('control.deleteTaskMode')"
      >
        <Trash2 class="w-5" />
      </button>

      <button
        class="tap-highlight-transparent relative flex h-8 touch-manipulation items-center justify-center border-2 px-1.5 transition-all duration-300 ease-in-out"
        :class="{
          'cursor-not-allowed opacity-25': !canAddTask,
          'cursor-pointer': canAddTask,
        }"
        :title="canAddTask ? t('control.newTask') : t('taskLimit')"
        @click="tryAddTask"
      >
        <Plus class="w-5" />
      </button>

      <button
        class="tap-highlight-transparent relative flex h-8 cursor-pointer touch-manipulation items-center justify-center border-2 px-1.5"
        @click="emit('toggle-settings')"
        :title="t('settings.title')"
      >
        <Settings class="w-5" />
      </button>

      <button
        v-if="!isCurrentMonth && store.tasks.length > 0"
        class="tap-highlight-transparent relative flex h-8 cursor-pointer touch-manipulation items-center justify-center border-2 px-1.5"
        @click="confirmDuplicateToCurrent"
        :title="t('control.duplicateToCurrent')"
      >
        <Copy class="w-5" />
      </button>
    </div>
  </div>
</template>
