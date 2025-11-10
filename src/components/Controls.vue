<script setup>
  import { ref, computed } from 'vue';
  import { useHabitStore } from '../stores/habitStore';
  import { useI18n } from 'vue-i18n';
  import { Plus, Trash2, Eraser, Settings, Copy } from 'lucide-vue-next';

  const store = useHabitStore();
  const { t } = useI18n();

  /** Состояние мобильного меню (открыто/закрыто) */
  const menuOpen = ref(false);

  const emit = defineEmits([
    /** Запрос переключения окна настроек */
    'toggle-settings',
  ]);

  /** Добавляет новую задачу */
  const handleAddTask = () => {
    store.addTask();
  };

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
</script>

<template>
  <div class="hide-print flex items-center gap-2">
    <!-- Мобильное меню -->
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
        {{ t('control.eraseMode') }}
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
        {{ t('control.deleteTaskMode') }}
      </button>

      <button
        class="flex w-full items-center rounded bg-gray-500 px-3 py-2 text-white"
        @click="emit('toggle-settings')"
      >
        <Settings class="mr-2 w-5" />
        {{ t('settings.title') }}
      </button>

      <button
        v-if="!isCurrentMonth"
        class="flex w-full items-center rounded bg-indigo-500 px-3 py-2 text-white"
        @click="store.duplicateToCurrentMonth"
      >
        <Copy class="mr-2 w-5" />
        {{ t('control.duplicateToCurrent') }}
      </button>

      <button
        class="flex w-full items-center rounded bg-red-500 px-3 py-2 text-white"
        @click="menuOpen = false"
      >
        {{ t('control.hideControl') }}
      </button>
    </div>

    <!-- Кнопка открытия мобильного меню -->
    <button
      v-else
      class="flex items-center rounded bg-blue-500 px-4 py-2 text-white md:hidden"
      @click="menuOpen = true"
    >
      <Plus class="w-5" />
      {{ t('control.title') }}
    </button>

    <!-- Десктопные кнопки -->
    <div v-if="!menuOpen" class="hidden gap-1.5 md:flex">
      <button
        :class="store.activeMode === 'eraser' ? 'bg-yellow-500 text-white' : 'text-yellow-500'"
        class="relative flex h-8 cursor-pointer items-center justify-center border-2 border-yellow-500 px-1.5 transition-all duration-300 ease-in-out"
        @click="store.toggleMode('eraser')"
        :title="t('control.eraseMode')"
      >
        <Eraser class="w-5" />
      </button>

      <button
        :class="store.activeMode === 'delete' ? 'bg-red-500 text-white' : 'text-red-500'"
        class="relative flex h-8 cursor-pointer items-center justify-center border-2 border-red-500 px-1.5 transition-all duration-300 ease-in-out"
        @click="store.toggleMode('delete')"
        :title="t('control.deleteTaskMode')"
      >
        <Trash2 class="w-5" />
      </button>

      <button
        class="relative flex h-8 cursor-pointer items-center justify-center border-2 px-1.5"
        @click="handleAddTask"
        :title="t('control.newTask')"
      >
        <Plus class="w-5" />
      </button>

      <button
        class="relative flex h-8 cursor-pointer items-center justify-center border-2 px-1.5"
        @click="emit('toggle-settings')"
        :title="t('settings.title')"
      >
        <Settings class="w-5" />
      </button>

      <button
        v-if="!isCurrentMonth"
        class="relative flex h-8 cursor-pointer items-center justify-center border-2 px-1.5"
        @click="store.duplicateToCurrentMonth"
        :title="t('control.duplicateToCurrent')"
      >
        <Copy class="w-5" />
      </button>
    </div>
  </div>
</template>
