import { useHabitStore } from '../stores/habitStore';

export function useModals(t) {
  const store = useHabitStore();

  /**
   * Показывает модальное окно о достижении лимита задач.
   * Используется при попытке добавить задачу сверх лимита.
   */
  const showTaskLimit = () => {
    store.showModal({
      type: 'alert',
      title: t('modal.warning'),
      message: t('taskLimit'),
      onConfirm: () => store.closeModal(),
    });
  };

  return { showTaskLimit };
}
