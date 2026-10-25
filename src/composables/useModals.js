import { useHabitStore } from '@/stores/habitStore';
import { useModalStore } from '@/stores/modalStore';

export function useModals(t) {
  const store = useHabitStore();
  const modalStore = useModalStore();

  /** Показывает модальное окно о достижении лимита задач */
  const showTaskLimit = () => {
    modalStore.showModal({
      type: 'alert',
      title: t('modal.warning'),
      message: t('taskLimit'),
      onConfirm: () => modalStore.closeModal(),
    });
  };

  /** Показывает приветственное сообщение, если пользователь его ещё не видел */
  const showWelcome = (force = false) => {
    if (!force && localStorage.getItem('hasSeenWelcome') === 'true') return;

    modalStore.showModal({
      type: 'custom',
      title: t('welcome.title'),
      html: t('welcome.message'),
      onConfirm: () => {
        if (!force) {
          localStorage.setItem('hasSeenWelcome', 'true');
        }
        modalStore.closeModal();
      },
    });
  };

  /** Показывает подтверждение дублирования задач в текущий месяц */
  const confirmDuplicateToCurrent = () => {
    const realMonthKey = store.realMonthKey;

    if (store.currentMonthKey === realMonthKey) return;

    modalStore.showModal({
      type: 'confirm',
      title: t('duplicate.title'),
      message: t('duplicate.message'),

      /** Дублирует задачи текущего месяца в текущий реальный */
      onConfirm: () => {
        const cleanTasks = store.tasks.map(task => ({
          ...task,
          id: Date.now() + Math.random(),
          subtasks: task.subtasks.map(() => ({
            id: Date.now() + Math.random(),
            marks: Array(store.daysInMonth).fill(null),
          })),
        }));

        store.archive[realMonthKey] = { tasks: cleanTasks };
        localStorage.setItem('habitArchive', JSON.stringify(store.archive));

        store.currentDate = new Date(store.realDate);
        store.tasks = cleanTasks;
        store.adaptMarksToNewMonth();
        store.saveState();
        modalStore.closeModal();
      },
      onCancel: () => modalStore.closeModal(),
    });
  };

  /** Показывает модальное окно с предложением обновить PWA */
  const showUpdatePrompt = updateSW => {
    modalStore.showModal({
      type: 'confirm',
      title: t('update.title'),
      message: t('update.message'),
      onConfirm: () => {
        updateSW(true);
      },
      onCancel: () => modalStore.closeModal(),
    });
  };

  /**
   * Предлагает выбрать между локальными и облачными данными при расхождении после входа.
   * Закрытие без выбора оставляет синхронизацию выключенной до следующего входа.
   */
  const showCloudConflict = () => {
    modalStore.showModal({
      type: 'confirm',
      title: t('conflict.title'),
      message: t('conflict.message'),
      confirmText: t('conflict.confirm'),
      cancelText: t('conflict.cancel'),
      onConfirm: () => store.resolveCloudConflict(true),
      onCancel: () => store.resolveCloudConflict(false),
      onDismiss: () => modalStore.closeModal(),
    });
  };

  return {
    showTaskLimit,
    showWelcome,
    confirmDuplicateToCurrent,
    showUpdatePrompt,
    showCloudConflict,
  };
}
