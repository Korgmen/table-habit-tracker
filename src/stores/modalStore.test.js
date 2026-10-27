import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useModalStore } from '@/stores/modalStore';

beforeEach(() => {
  setActivePinia(createPinia());
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('очередь модальных окон', () => {
  it('окно, открытое поверх другого, ждёт его закрытия', () => {
    const store = useModalStore();
    store.showModal('welcome');
    store.showModal('conflict');
    expect(store.modal.name).toBe('welcome');

    store.closeModal();
    expect(store.modal.name).toBe('conflict');

    store.closeModal();
    expect(store.isOpen).toBe(false);
  });

  it('новое окно не наследует параметры предыдущего', () => {
    const store = useModalStore();
    store.showModal('habit', { taskId: 1 });
    store.closeModal();
    store.showModal('habit');
    expect(store.modal).toEqual({ name: 'habit', props: {} });
  });

  it('replaceModal подменяет окно, не трогая очередь', () => {
    const store = useModalStore();
    store.showModal('settings');
    store.showModal('conflict');
    store.replaceModal('welcome');
    expect(store.modal.name).toBe('welcome');
    store.closeModal();
    expect(store.modal.name).toBe('conflict');
  });
});

describe('тост', () => {
  it('скрывается сам, если не persistent', () => {
    const store = useModalStore();
    store.showToast('saved');
    vi.advanceTimersByTime(3200);
    expect(store.toast).toBeNull();
  });

  it('persistent остаётся, действие выполняется и скрывает тост', () => {
    const store = useModalStore();
    const onAction = vi.fn();
    store.showToast('update', { actionText: 'go', onAction, persistent: true });
    vi.advanceTimersByTime(60000);
    expect(store.toast).not.toBeNull();

    store.runToastAction();
    expect(onAction).toHaveBeenCalledOnce();
    expect(store.toast).toBeNull();
  });
});
