import { defineStore } from 'pinia';

/** Время показа тоста без действия и с действием (отмена удаления и т.п.), мс */
const TOAST_DURATION = 3200;
const TOAST_ACTION_DURATION = 6000;
let toastTimer = null;

/** Пустое состояние глобального модального окна */
const emptyModal = () => ({ name: null, props: {} });

/** Хранилище глобального модального окна и тоста */
export const useModalStore = defineStore('modal', {
  state: () => ({
    /** Открытое окно: name – 'settings' | 'habit' | 'duplicate' | 'welcome' | 'conflict' */
    modal: emptyModal(),
    /** Окна, запрошенные при уже открытом окне: показываются по очереди после его закрытия */
    modalQueue: [],
    /** Тост: { text, actionText, onAction } или null */
    toast: null,
  }),

  getters: {
    isOpen: state => state.modal.name !== null,
  },

  actions: {
    /**
     * Открывает окно, а если другое уже открыто, ставит в очередь.
     * @param {string} name - имя окна
     * @param {Object} props - параметры окна (например, { taskId } для привычки)
     */
    showModal(name, props = {}) {
      if (this.isOpen) {
        this.modalQueue.push({ name, props });
        return;
      }
      this.modal = { name, props };
    },

    /** Закрывает текущее окно и сразу открывает другое, минуя очередь */
    replaceModal(name, props = {}) {
      this.modal = { name, props };
    },

    /** Закрывает модальное окно и открывает следующее из очереди, если оно есть */
    closeModal() {
      this.modal = this.modalQueue.shift() || emptyModal();
    },

    /**
     * Показывает тост поверх интерфейса.
     * @param {string} text - текст
     * @param {Object} options - { actionText, onAction, persistent }; persistent не скрывается сам
     */
    showToast(text, { actionText = '', onAction = null, persistent = false } = {}) {
      clearTimeout(toastTimer);
      this.toast = { text, actionText, onAction };
      if (!persistent) {
        toastTimer = setTimeout(
          () => this.closeToast(),
          actionText ? TOAST_ACTION_DURATION : TOAST_DURATION
        );
      }
    },

    /** Скрывает тост */
    closeToast() {
      clearTimeout(toastTimer);
      this.toast = null;
    },

    /** Выполняет действие тоста и скрывает его */
    runToastAction() {
      const action = this.toast?.onAction;
      this.closeToast();
      action?.();
    },
  },
});
