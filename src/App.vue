<script setup>
  import { useHabitStore } from '@/stores/habitStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { ref, onMounted, onUnmounted } from 'vue';
  import { VueDraggableNext } from 'vue-draggable-next';
  import { useI18n } from 'vue-i18n';
  import Header from '@/components/Header.vue';
  import TableHeader from '@/components/TableHeader.vue';
  import TaskRow from '@/components/TaskRow.vue';
  import Modal from '@/components/Modal.vue';

  const store = useHabitStore();
  const { currentTheme, canNextMonth } = useHabitUtils();
  const { t } = useI18n();
  const { showTaskLimit, showWelcome } = useModals(t);

  /** Ссылка на скрытый input для импорта файла */
  const importInput = ref(null);

  /** Состояние открытия окна настроек */
  const settingsOpen = ref(false);

  /**
   * Обрабатывает глобальные горячие клавиши.
   * Игнорирует ввод в полях ввода.
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
      KeyN: () => {
        if (!store.addTask()) {
          showTaskLimit();
        }
      },
      ArrowLeft: () => store.prevMonth(),
      ArrowRight: () => canNextMonth.value && store.nextMonth(),
      KeyS: () => {
        settingsOpen.value = !settingsOpen.value;
        store.activeMode = null;
      },
    };

    keyActions[event.code]?.();
  };

  /** Открывает системный диалог выбора файла для импорта */
  const triggerImport = () => importInput.value.click();

  /** Инициирует печать страницы */
  const triggerPrint = () => window.print();

  /** Подписка на глобальные клавиатурные события */
  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
    /** Показывает приветственное модальное окно при первом запуске */
    showWelcome();
  });

  /** Очистка глобального обработчика клавиш */
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<template>
  <!-- Корневой контейнер с применением темы -->
  <div
    id="app"
    class="flex md:min-h-screen print:min-h-screen"
    :class="currentTheme === 'dark' ? 'bg-[#292929] text-[#FFF8F0]' : 'bg-white text-[#12130F]'"
  >
    <div
      class="relative mx-auto flex w-full flex-col gap-2.5 max-md:not-print:h-[100dvh] max-md:not-print:flex-col-reverse max-md:not-print:pb-2.5 md:my-5 md:w-fit md:min-w-[960px] print:my-5 print:w-fit print:min-w-[960px]"
    >
      <!-- Шапка: месяц, статистика, управление -->
      <Header
        :settingsOpen="settingsOpen"
        :currentTheme="currentTheme"
        @update:settingsOpen="settingsOpen = $event"
        @import="triggerImport"
        @print="triggerPrint"
      />

      <!-- Таблица привычек -->
      <div
        class="overscroll-contain max-md:not-print:overflow-x-auto max-md:not-print:overflow-y-auto"
      >
        <div
          class="w-fit border-t-3 border-b-3 select-none md:w-auto md:border-3 print:w-auto print:border-3"
        >
          <!-- Заголовки дней -->
          <TableHeader />

          <!-- Перетаскиваемый список задач -->
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

      <!-- Скрытый input для импорта JSON-файла -->
      <input
        ref="importInput"
        type="file"
        style="display: none"
        accept=".json"
        @change="store.importData"
      />
    </div>

    <!-- Глобальное модальное окно -->
    <Modal />
  </div>
</template>
