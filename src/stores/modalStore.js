import { defineStore } from 'pinia';

/** Пустое состояние глобального модального окна */
const emptyModal = () => ({
  isOpen: false,
  title: '',
  message: '',
  /** Разметка из словарей (приветствие); пользовательские данные идут только в message */
  html: '',
  type: 'alert',
  onConfirm: null,
  onCancel: null,
  /** Закрытие крестиком или Escape, по умолчанию вызывается onCancel */
  onDismiss: null,
  confirmText: '',
  cancelText: '',
});

/** Хранилище глобального модального окна */
export const useModalStore = defineStore('modal', {
  state: () => ({
    /** Состояние глобального модального окна */
    modal: emptyModal(),
    /** Окна, запрошенные при уже открытом окне: показываются по очереди после его закрытия */
    modalQueue: [],
  }),

  actions: {
    /**
     * Открывает модальное окно с заданными параметрами.
     * @param {Object} options - { type: 'alert'|'confirm'|'custom', title, message, onConfirm, onCancel, confirmText, cancelText }
     */
    showModal(options) {
      if (this.modal.isOpen) {
        this.modalQueue.push(options);
        return;
      }
      this.modal = { ...emptyModal(), isOpen: true, ...options };
    },

    /** Закрывает модальное окно и открывает следующее из очереди, если оно есть */
    closeModal() {
      const next = this.modalQueue.shift();
      this.modal = next ? { ...emptyModal(), isOpen: true, ...next } : emptyModal();
    },
  },
});
