import { inject, shallowRef, watch, onMounted, onUnmounted } from 'vue';
import { useHabitStore } from '@/stores/habitStore';
import { useModalStore } from '@/stores/modalStore';
import { MAX_TASKS } from '@/utils/archive';

/** Ключ provide/inject: id окна в стеке modalStore для компонента окна (ModalEntry.vue) */
export const MODAL_ID = Symbol('modalId');

/** Функция применения обновления PWA, пока пользователь его не принял; null – обновления нет */
const pendingUpdate = shallowRef(null);

/**
 * Управление окном изнутри его компонента: закрывается именно это окно (и окна поверх него),
 * а не верхнее, так что watch нижнего окна не закроет чужое.
 */
export function useModalEntry() {
  const modalStore = useModalStore();
  const id = inject(MODAL_ID, null);
  return {
    id,
    close: () => modalStore.closeModal(id),
    closeAll: () => modalStore.closeAllModals(),
  };
}

/**
 * Кнопка «назад» (телефон, браузер) закрывает верхнее окно. Пока окна открыты, в истории лежит
 * одна запись: «назад» закрывает верхнее и, если под ним есть ещё, кладёт запись снова; закрытие
 * последнего окна кнопкой убирает запись через history.back(). Вызывается один раз в App.vue.
 */
export function useModalHistory() {
  const modalStore = useModalStore();
  /** В истории есть запись открытых окон */
  let armed = false;
  /** Следующий popstate вызван нашим history.back() */
  let skipPop = false;

  const arm = () => {
    history.pushState({ modal: true }, '');
    armed = true;
  };

  watch(
    () => modalStore.isOpen,
    open => {
      if (open && !armed) arm();
      else if (!open && armed) {
        armed = false;
        skipPop = true;
        history.back();
      }
    }
  );

  const handlePopState = () => {
    if (skipPop) {
      skipPop = false;
      return;
    }
    if (!armed) return;
    armed = false;
    modalStore.closeModal();
    if (modalStore.isOpen) arm();
  };

  onMounted(() => window.addEventListener('popstate', handlePopState));
  onUnmounted(() => window.removeEventListener('popstate', handlePopState));
}

export function useModals(t) {
  const store = useHabitStore();
  const modalStore = useModalStore();

  /** Открывает окно новой привычки или сообщает о лимите */
  const openNewHabit = () => {
    if (store.tasks.length >= MAX_TASKS) {
      modalStore.showToast(t('taskLimit', { max: MAX_TASKS }, MAX_TASKS));
      return;
    }
    modalStore.openModal('habit');
  };

  /**
   * Открывает окно привычки для правки.
   * @param {number} focusDay - число для заметки из окна (выбранный день на телефоне)
   */
  const openHabit = (taskId, focusDay = null) =>
    modalStore.openModal('habit', { taskId, focusDay });

  /** Открывает заметку к дню привычки поверх открытых окон */
  const openNote = (taskId, day) => modalStore.openModal('note', { taskId, day });

  /** Окно настроек */
  const openSettings = () => modalStore.openModal('settings');

  /** Окно статистики по всем месяцам */
  const openStats = () => modalStore.openModal('stats');

  /** Поиск по всем месяцам и заметкам с начальным запросом */
  const openSearch = (query = '') => modalStore.openModal('search', { query });

  /** Тост о только что сделанном изменении с кнопкой, которая отменяет именно его */
  const toastWithUndo = text => {
    const id = store.lastChangeId;
    modalStore.showToast(text, {
      actionText: t('history.undo'),
      onAction: () => {
        if (!store.undoTo(id)) modalStore.showToast(t('history.gone'));
      },
    });
  };

  /** Отменяет последний шаг и предлагает вернуть его */
  const undoLast = () => {
    const label = store.undo();
    if (!label) return;
    modalStore.showToast(t('history.undone', { action: t(`history.action.${label}`) }), {
      actionText: t('history.redo'),
      onAction: redoLast,
    });
  };

  /** Повторяет отменённый шаг */
  const redoLast = () => {
    const label = store.redo();
    if (label) modalStore.showToast(t('history.redone', { action: t(`history.action.${label}`) }));
  };

  /** Удаляет привычку и предлагает вернуть её из тоста */
  const deleteHabit = taskId => {
    const title = store.tasks.find(task => task.id === taskId)?.title;
    if (store.deleteTask(taskId)) toastWithUndo(t('habit.deleted', { title }));
  };

  /**
   * Показывает приветствие: при первом запуске – когда пользователь закончит с открытыми окнами,
   * по кнопке в настройках (force) – сразу поверх них.
   */
  const showWelcome = (force = false) => {
    if (force) modalStore.openModal('welcome');
    else if (localStorage.getItem('hasSeenWelcome') !== 'true') modalStore.queueModal('welcome');
  };

  /** Применяет ожидающее обновление PWA */
  const applyUpdate = () => pendingUpdate.value?.();

  /**
   * Предлагает обновить PWA. Закрытый тост не теряет обновление: в настройках остаётся строка
   * «Доступно обновление».
   */
  const showUpdatePrompt = updateSW => {
    pendingUpdate.value = () => updateSW(true);
    modalStore.showToast(t('update.message'), {
      actionText: t('update.action'),
      onAction: applyUpdate,
      persistent: true,
    });
  };

  /** Приложение закэшировано и откроется без сети */
  const showOfflineReady = () => modalStore.showToast(t('update.offlineReady'));

  /** Предлагает выбрать между версиями устройства и облака, когда пользователь освободится */
  const showCloudConflict = () => modalStore.queueModal('conflict');

  return {
    openNewHabit,
    openHabit,
    openNote,
    openSettings,
    openStats,
    openSearch,
    toastWithUndo,
    undoLast,
    redoLast,
    deleteHabit,
    showWelcome,
    showUpdatePrompt,
    showOfflineReady,
    pendingUpdate,
    applyUpdate,
    showCloudConflict,
  };
}
