import { useHabitStore, MAX_TASKS } from '@/stores/habitStore';
import { useModalStore } from '@/stores/modalStore';

export function useModals(t) {
  const store = useHabitStore();
  const modalStore = useModalStore();

  /** Открывает окно новой привычки или сообщает о лимите */
  const openNewHabit = () => {
    if (store.tasks.length >= MAX_TASKS) {
      modalStore.showToast(t('taskLimit', { max: MAX_TASKS }));
      return;
    }
    modalStore.showModal('habit');
  };

  /** Открывает окно привычки для правки */
  const openHabit = taskId => modalStore.showModal('habit', { taskId });

  /** Удаляет привычку и предлагает вернуть её из тоста */
  const deleteHabit = taskId => {
    const title = store.tasks.find(task => task.id === taskId)?.title;
    const removed = store.deleteTask(taskId);
    if (!removed) return;
    modalStore.showToast(t('habit.deleted', { title }), {
      actionText: t('habit.undo'),
      onAction: () => store.restoreTask(removed),
    });
  };

  /** Показывает приветствие, если пользователь его ещё не видел */
  const showWelcome = (force = false) => {
    if (!force && localStorage.getItem('hasSeenWelcome') === 'true') return;
    if (force) modalStore.replaceModal('welcome');
    else modalStore.showModal('welcome');
  };

  /** Предлагает обновить PWA */
  const showUpdatePrompt = updateSW => {
    modalStore.showToast(t('update.message'), {
      actionText: t('update.action'),
      onAction: () => updateSW(true),
      persistent: true,
    });
  };

  /** Предлагает выбрать между локальными и облачными данными при расхождении после входа */
  const showCloudConflict = () => modalStore.showModal('conflict');

  return {
    openNewHabit,
    openHabit,
    deleteHabit,
    showWelcome,
    showUpdatePrompt,
    showCloudConflict,
  };
}
