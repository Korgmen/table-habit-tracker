<script setup>
  import { useHabitStore } from './stores/habitStore';
  import { useHabitUtils } from './composables/useHabitUtils';
  import { ref, onMounted, onUnmounted } from 'vue';
  import { VueDraggableNext } from 'vue-draggable-next';
  import { useI18n } from 'vue-i18n';
  import Header from './components/Header.vue';
  import TableHeader from './components/TableHeader.vue';
  import TaskRow from './components/TaskRow.vue';
  import Modal from './components/Modal.vue';

  const store = useHabitStore();
  const { currentTheme, canNextMonth } = useHabitUtils();
  const { t } = useI18n();

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

  /** Открывает системный диалог выбора файла для импорта */
  const triggerImport = () => importInput.value.click();

  /** Инициирует печать страницы */
  const triggerPrint = () => window.print();

  /** Подписка на глобальные клавиатурные события */
  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);

    /** Показывает приветственное модальное окно при первом запуске */
    if (!localStorage.getItem('hasSeenWelcome')) {
      store.showModal({
        type: 'alert',
        title: t('welcome.title'),
        message: t('welcome.message'),
        onConfirm: () => {
          localStorage.setItem('hasSeenWelcome', 'true');
          store.closeModal();
        },
      });
    }
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
    class="flex min-h-screen justify-center"
    :class="currentTheme === 'dark' ? 'bg-[#292929] text-[#FFF8F0]' : 'bg-white text-[#12130F]'"
  >
    <div class="relative mx-auto my-5 flex w-fit flex-col gap-2.5">
      <!-- Шапка: месяц, статистика, управление -->
      <Header
        :settingsOpen="settingsOpen"
        :currentTheme="currentTheme"
        @update:settingsOpen="settingsOpen = $event"
        @import="triggerImport"
        @print="triggerPrint"
      />

      <!-- Таблица привычек -->
      <div class="overflow-x-auto">
        <div class="border-3 select-none">
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
