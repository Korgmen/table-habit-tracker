import { useHabitStore } from '@/stores/habitStore';

export function useModals(t) {
  const store = useHabitStore();

  /** Показывает модальное окно о достижении лимита задач */
  const showTaskLimit = () => {
    store.showModal({
      type: 'alert',
      title: t('modal.warning'),
      message: t('taskLimit'),
      onConfirm: () => store.closeModal(),
    });
  };

  /** Показывает приветственное сообщение, если пользователь его ещё не видел */
  const showWelcome = (force = false) => {
    if (!force && localStorage.getItem('hasSeenWelcome') === 'true') return;

    store.showModal({
      type: 'custom',
      title: t('welcome.title'),
      html: t('welcome.message'),
      onConfirm: () => {
        if (!force) {
          localStorage.setItem('hasSeenWelcome', 'true');
        }
        store.closeModal();
      },
    });
  };

  /** Показывает подтверждение дублирования задач в текущий месяц */
  const confirmDuplicateToCurrent = () => {
    const realMonthKey = store.realMonthKey;

    if (store.currentMonthKey === realMonthKey) return;

    store.showModal({
      type: 'confirm',
      title: t('duplicate.title'),
      message: t('duplicate.message'),

      /** Дублирует задачи текущего месяца в текущий реальный */
      onConfirm: () => {
        const cleanTasks = store.tasks.map(task => ({
          ...task,
          id: Date.now() + Math.random(),
          subtasks: task.subtasks.map(sub => ({
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
        store.closeModal();
      },
      onCancel: () => store.closeModal(),
    });
  };

  /** Показывает модальное окно с предложением обновить PWA */
  const showUpdatePrompt = updateSW => {
    store.showModal({
      type: 'confirm',
      title: t('update.title'),
      message: t('update.message'),
      onConfirm: () => {
        updateSW(true);
      },
      onCancel: () => store.closeModal(),
    });
  };

  /**
   * Предлагает выбрать между локальными и облачными данными при расхождении после входа.
   * Закрытие без выбора оставляет синхронизацию выключенной до следующего входа.
   */
  const showCloudConflict = () => {
    store.showModal({
      type: 'confirm',
      title: t('conflict.title'),
      message: t('conflict.message'),
      confirmText: t('conflict.confirm'),
      cancelText: t('conflict.cancel'),
      onConfirm: () => store.resolveCloudConflict(true),
      onCancel: () => store.resolveCloudConflict(false),
      onDismiss: () => store.closeModal(),
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
