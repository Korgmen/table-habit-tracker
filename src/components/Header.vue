<script setup>
  import { ref, watch } from 'vue';
  import SettingsModal from './SettingsModal.vue';
  import MonthHeader from './MonthHeader.vue';
  import OverallStats from './OverallStats.vue';
  import Controls from './Controls.vue';

  const props = defineProps({
    /** Открыто ли окно настроек */
    settingsOpen: Boolean,
    /** Текущая тема (light/dark) */
    currentTheme: String,
  });

  const emit = defineEmits([
    /** Обновление состояния открытия настроек */
    'update:settingsOpen',
    /** Запрос импорта данных */
    'import',
    /** Запрос печати */
    'print',
  ]);

  /** Локальное состояние открытия настроек (для v-model) */
  const localSettingsOpen = ref(props.settingsOpen);

  /** Синхронизация локального состояния с пропсом */
  watch(
    () => props.settingsOpen,
    newVal => {
      localSettingsOpen.value = newVal;
    }
  );

  /** Эмитирует обновление состояния открытия настроек */
  watch(localSettingsOpen, newVal => {
    emit('update:settingsOpen', newVal);
  });

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
    localSettingsOpen.value = !localSettingsOpen.value;
  };
</script>

<template>
  <!-- Окно настроек -->
  <transition name="fade" mode="out-in">
    <SettingsModal
      v-if="localSettingsOpen"
      :isOpen="localSettingsOpen"
      :currentTheme="currentTheme"
      @close="localSettingsOpen = false"
      @import="handleImport"
      @print="handlePrint"
    />
  </transition>

  <!-- Основная панель: месяц, статистика, управление -->
  <div class="flex items-center gap-4 select-none">
    <MonthHeader />
    <OverallStats />
    <Controls @toggle-settings="toggleSettings" />
  </div>
</template>
