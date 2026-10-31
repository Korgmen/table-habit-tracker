import { defineStore } from 'pinia';

/** Время показа тоста без действия и с действием (отмена, обновление), мс */
const TOAST_DURATION = 4000;
const TOAST_ACTION_DURATION = 10000;
let toastTimer = null;
/** Сколько осталось показывать тост, пока он на паузе (наведение или фокус) */
let toastRemaining = 0;
let toastDeadline = 0;

let lastModalId = 0;

/**
 * Хранилище окон и тоста.
 *
 * Окна – стек: окно, открытое из другого окна (заметка из привычки, импорт из настроек), ложится
 * поверх, а его закрытие возвращает к нижнему. Окна, которые приложение показывает само
 * (приветствие, конфликт облака), ждут в очереди, пока стек не опустеет. Компонент окна
 * закрывает себя через useModalEntry() (src/composables/useModals.js) – по своему id, а не
 * «верхнее окно», поэтому закрытие из watch нижнего окна не трогает чужие.
 */
export const useModalStore = defineStore('modal', {
  state: () => ({
    /**
     * Открытые окна снизу вверх: [{ id, name, props }]; name – 'settings' | 'habit' | 'note' |
     * 'duplicate' | 'welcome' | 'conflict' | 'import' | 'stats' | 'search' | 'photo'
     */
    stack: [],
    /** Окна, которые откроются, когда стек опустеет: [{ name, props }] */
    queue: [],
    /** Тост: { text, actionText, onAction, persistent } или null */
    toast: null,
  }),

  getters: {
    isOpen: state => state.stack.length > 0,
    /** Верхнее (активное) окно или null */
    top: state => state.stack.at(-1) ?? null,
  },

  actions: {
    /**
     * Открывает окно поверх открытых.
     * @param {string} name - имя окна
     * @param {Object} props - параметры окна (например, { taskId } для привычки)
     * @returns {number} id окна
     */
    openModal(name, props = {}) {
      const id = ++lastModalId;
      this.stack.push({ id, name, props });
      return id;
    },

    /**
     * Показывает окно, когда пользователь закончит с открытыми: сразу, если окон нет, иначе
     * после закрытия последнего. Окно с тем же именем дважды не ставится.
     */
    queueModal(name, props = {}) {
      if ([...this.stack, ...this.queue].some(entry => entry.name === name)) return;
      if (this.isOpen) this.queue.push({ name, props });
      else this.openModal(name, props);
    },

    /**
     * Закрывает окно и все окна поверх него; без id – верхнее. Когда окон не осталось,
     * открывается следующее из очереди.
     */
    closeModal(id = null) {
      const index =
        id === null ? this.stack.length - 1 : this.stack.findIndex(entry => entry.id === id);
      if (index < 0) return;
      this.stack.splice(index);
      this.openQueued();
    },

    /** Закрывает все окна (переход к месяцу из статистики или поиска) */
    closeAllModals() {
      this.stack = [];
      this.openQueued();
    },

    openQueued() {
      if (this.isOpen || this.queue.length === 0) return;
      const { name, props } = this.queue.shift();
      this.openModal(name, props);
    },

    /**
     * Показывает тост поверх интерфейса. Тост с действием держится дольше; пока на нём курсор
     * или фокус, он не скрывается (pauseToast / resumeToast).
     * @param {string} text - текст
     * @param {Object} options - { actionText, onAction, persistent }; persistent не скрывается сам
     */
    showToast(text, { actionText = '', onAction = null, persistent = false } = {}) {
      clearTimeout(toastTimer);
      toastTimer = null;
      this.toast = { text, actionText, onAction, persistent };
      if (!persistent) this.startToastTimer(actionText ? TOAST_ACTION_DURATION : TOAST_DURATION);
    },

    startToastTimer(duration) {
      clearTimeout(toastTimer);
      toastDeadline = Date.now() + duration;
      toastTimer = setTimeout(() => this.closeToast(), duration);
    },

    /** Останавливает отсчёт до скрытия тоста */
    pauseToast() {
      if (!this.toast || this.toast.persistent || toastTimer === null) return;
      clearTimeout(toastTimer);
      toastTimer = null;
      toastRemaining = Math.max(toastDeadline - Date.now(), 0);
    },

    /** Продолжает отсчёт; после паузы тост держится ещё не меньше 2 секунд */
    resumeToast() {
      if (!this.toast || this.toast.persistent || toastTimer !== null) return;
      this.startToastTimer(Math.max(toastRemaining, 2000));
    },

    /** Скрывает тост */
    closeToast() {
      clearTimeout(toastTimer);
      toastTimer = null;
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
