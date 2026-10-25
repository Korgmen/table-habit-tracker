import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useModalStore } from '@/stores/modalStore';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('очередь модальных окон', () => {
  it('окно, открытое поверх другого, ждёт его закрытия', () => {
    const store = useModalStore();
    store.showModal({ type: 'confirm', title: 'conflict' });
    store.showModal({ type: 'confirm', title: 'update' });
    expect(store.modal.title).toBe('conflict');

    store.closeModal();
    expect(store.modal.isOpen).toBe(true);
    expect(store.modal.title).toBe('update');

    store.closeModal();
    expect(store.modal.isOpen).toBe(false);
  });

  it('новое окно не наследует поля предыдущего', () => {
    const store = useModalStore();
    store.showModal({ type: 'custom', title: 'welcome', html: '<b>hi</b>', confirmText: 'Go' });
    store.closeModal();
    store.showModal({ title: 'warning' });
    expect(store.modal).toMatchObject({
      isOpen: true,
      title: 'warning',
      type: 'alert',
      html: '',
      confirmText: '',
      onConfirm: null,
    });
  });
});
