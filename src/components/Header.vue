<script setup>
  import { ref, watch } from 'vue';
  import SettingsModal from '@/components/SettingsModal.vue';
  import MonthHeader from '@/components/MonthHeader.vue';
  import OverallStats from '@/components/OverallStats.vue';
  import Controls from '@/components/Controls.vue';

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
  <div
    class="flex flex-col-reverse items-end-safe gap-1.5 px-1.5 select-none md:flex-row md:items-center md:gap-4 md:px-0 print:flex-row print:items-center print:gap-4 print:px-0"
  >
    <MonthHeader />
    <OverallStats />
    <Controls @toggle-settings="toggleSettings" />
  </div>
</template>
