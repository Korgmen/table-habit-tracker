import { useHabitStore } from '@/stores/habitStore';
import { useModalStore } from '@/stores/modalStore';
import { MAX_TASKS } from '@/utils/archive';

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

  /**
   * Открывает окно привычки для правки.
   * @param {number} focusDay - число для заметки из окна (выбранный день на телефоне)
   */
  const openHabit = (taskId, focusDay = null) =>
    modalStore.showModal('habit', { taskId, focusDay });

  /** Открывает заметку к дню привычки; back – после закрытия вернуться в окно привычки */
  const openNote = (taskId, day, back = false) => {
    if (back) modalStore.replaceModal('note', { taskId, day, back });
    else modalStore.showModal('note', { taskId, day });
  };

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
    openNote,
    toastWithUndo,
    undoLast,
    redoLast,
    deleteHabit,
    showWelcome,
    showUpdatePrompt,
    showCloudConflict,
  };
}
