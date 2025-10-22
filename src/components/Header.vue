<!-- src/components/Header.vue -->
<script setup>
  import { ref, computed, watch } from 'vue'; // ← ДОБАВЛЕН watch
  import { useI18n } from 'vue-i18n';
  import SettingsModal from './SettingsModal.vue';
  import MonthHeader from './MonthHeader.vue';
  import OverallStats from './OverallStats.vue';
  import Controls from './Controls.vue';

  const props = defineProps({
    settingsOpen: Boolean,
    currentTheme: String,
  });

  const emit = defineEmits(['update:settingsOpen', 'import', 'print']);

  const { t } = useI18n();
  const localSettingsOpen = ref(props.settingsOpen);

  // Синхронизация с родительским v-model
  watch(
    () => props.settingsOpen,
    newVal => {
      localSettingsOpen.value = newVal;
    }
  );

  watch(localSettingsOpen, newVal => {
    emit('update:settingsOpen', newVal);
  });

  const handleImport = () => {
    emit('import');
  };

  const handlePrint = () => {
    emit('print');
  };

  const toggleSettings = () => {
    localSettingsOpen.value = !localSettingsOpen.value;
  };
</script>

<template>
  <!-- Настройки -->
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

  <!-- Блок текущей даты и управления -->
  <div class="flex items-center gap-4 select-none">
    <MonthHeader />
    <OverallStats />
    <Controls @toggle-settings="toggleSettings" />
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
</style>
