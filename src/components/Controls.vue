<!-- src/components/Controls.vue -->
<script setup>
  import { ref } from 'vue';
  import { useHabitStore } from '../stores/habitStore';
  import { useI18n } from 'vue-i18n';
  import { Plus, Trash2, Eraser, Settings } from 'lucide-vue-next';

  const store = useHabitStore();
  const { t } = useI18n();
  const menuOpen = ref(false);
  const emit = defineEmits(['toggle-settings']);

  const handleAddTask = () => {
    store.addTask();
  };
</script>

<template>
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
        @click="emit('toggle-settings')"
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
        :class="store.activeMode === 'eraser' ? 'bg-yellow-500 text-white' : 'text-yellow-500'"
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
        @click="emit('toggle-settings')"
      >
        <Settings class="w-5" />
      </button>
    </div>
  </div>
</template>
