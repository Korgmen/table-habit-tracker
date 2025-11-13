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
  const showWelcome = () => {
    if (localStorage.getItem('hasSeenWelcome') === 'true') return;

    store.showModal({
      type: 'custom',
      title: t('welcome.title'),
      message: t('welcome.message'),
      onConfirm: () => {
        localStorage.setItem('hasSeenWelcome', 'true');
        store.closeModal();
      },
    });
  };

  /** Показывает подтверждение дублирования задач в текущий месяц */
  const confirmDuplicateToCurrent = () => {
    const realMonthKey = `${store.realDate.getFullYear()}-${String(store.realDate.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthKey = `${store.currentYear}-${String(store.currentMonth + 1).padStart(2, '0')}`;

    if (currentMonthKey === realMonthKey) return;

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

  return {
    showTaskLimit,
    showWelcome,
    confirmDuplicateToCurrent,
  };
}
