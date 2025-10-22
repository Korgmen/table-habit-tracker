<!-- src/App.vue -->
<script setup>
  import { useHabitStore } from './stores/habitStore';
  import { ref, onMounted, onUnmounted, computed } from 'vue';
  import { VueDraggableNext } from 'vue-draggable-next';
  import Header from './components/Header.vue';
  import TableHeader from './components/TableHeader.vue';
  import TaskRow from './components/TaskRow.vue';

  const store = useHabitStore();
  const importInput = ref(null);
  const settingsOpen = ref(false);

  /**
   * Обрабатывает нажатие клавиш.
   */
  const handleKeydown = event => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

    const keyActions = {
      Escape: () => {
        store.activeMode = null;
        settingsOpen.value = false;
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
   * Определяет текущую тему.
   */
  const currentTheme = computed(() => {
    if (store.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return store.theme;
  });

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
      <!-- Header с настройками, месяцем, статистикой и контролами -->
      <Header
        :settingsOpen="settingsOpen"
        :currentTheme="currentTheme"
        @update:settingsOpen="settingsOpen = $event"
        @import="handleImport"
        @print="handlePrint"
      />

      <!-- Таблица привычек -->
      <div class="overflow-x-auto">
        <div class="border-3 select-none">
          <TableHeader />
          <VueDraggableNext
            v-model="store.tasks"
            item-key="id"
            handle=".drag-handle"
            @end="store.saveState"
          >
            <template v-for="task in store.tasks" :key="task.id">
              <TaskRow :task="task" />
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
