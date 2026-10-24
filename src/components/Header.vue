<script setup>
  import SettingsModal from '@/components/SettingsModal.vue';
  import MonthHeader from '@/components/MonthHeader.vue';
  import OverallStats from '@/components/OverallStats.vue';
  import Controls from '@/components/Controls.vue';

  defineProps({
    /** Текущая тема (light/dark) */
    currentTheme: String,
  });

  /** Открыто ли окно настроек */
  const settingsOpen = defineModel('settingsOpen', { type: Boolean });

  const emit = defineEmits([
    /** Запрос импорта данных */
    'import',
    /** Запрос печати */
    'print',
  ]);

  /** Передаёт событие импорта вверх */
  const handleImport = () => {
    emit('import');
  };

  /** Передаёт событие печати вверх */
  const handlePrint = () => {
    emit('print');
  };

  /** Переключает открытие окна настроек */
  const toggleSettings = () => {
    settingsOpen.value = !settingsOpen.value;
  };
</script>

<template>
  <!-- Окно настроек -->
  <transition name="fade" mode="out-in">
    <SettingsModal
      v-if="settingsOpen"
      :currentTheme="currentTheme"
      @close="settingsOpen = false"
      @import="handleImport"
      @print="handlePrint"
    />
  </transition>

  <!-- Основная панель: месяц, статистика, управление -->
  <div
    class="flex flex-col-reverse items-end-safe gap-1.5 px-1.5 select-none md:flex-row md:items-center md:gap-4 md:px-0 print:flex-row print:items-center print:gap-4 print:px-0"
  >
    <MonthHeader />
    <OverallStats />
    <Controls @toggle-settings="toggleSettings" />
  </div>
</template>
