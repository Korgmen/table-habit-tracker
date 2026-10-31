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

const names = store => store.stack.map(entry => entry.name);

describe('стек окон', () => {
  it('окно из окна ложится поверх, закрытие возвращает к нижнему', () => {
    const store = useModalStore();
    store.openModal('habit', { taskId: 1 });
    store.openModal('note', { taskId: 1, day: 3 });
    expect(names(store)).toEqual(['habit', 'note']);
    expect(store.top.name).toBe('note');

    store.closeModal();
    expect(store.top).toMatchObject({ name: 'habit', props: { taskId: 1 } });
    store.closeModal();
    expect(store.isOpen).toBe(false);
  });

  it('закрытие по id убирает окно и всё, что над ним, чужой или старый id не трогает', () => {
    const store = useModalStore();
    const settings = store.openModal('settings');
    const importId = store.openModal('import');
    store.openModal('conflict');

    store.closeModal(importId);
    expect(names(store)).toEqual(['settings']);
    store.closeModal(importId);
    expect(names(store)).toEqual(['settings']);
    store.closeModal(settings);
    expect(store.isOpen).toBe(false);
  });

  it('каждое открытие – новое окно со своими параметрами', () => {
    const store = useModalStore();
    const first = store.openModal('habit', { taskId: 1 });
    store.closeModal();
    const second = store.openModal('habit');
    expect(second).not.toBe(first);
    expect(store.top.props).toEqual({});
  });

  it('closeAllModals закрывает весь стек', () => {
    const store = useModalStore();
    store.openModal('habit');
    store.openModal('note');
    store.closeAllModals();
    expect(store.isOpen).toBe(false);
  });
});

describe('очередь окон', () => {
  it('окно из очереди ждёт, пока стек не опустеет', () => {
    const store = useModalStore();
    store.openModal('settings');
    store.openModal('import');
    store.queueModal('conflict');
    expect(names(store)).toEqual(['settings', 'import']);

    store.closeModal();
    expect(names(store)).toEqual(['settings']);
    store.closeModal();
    expect(names(store)).toEqual(['conflict']);
  });

  it('без открытых окон открывается сразу, одно имя дважды не ставится', () => {
    const store = useModalStore();
    store.queueModal('welcome');
    store.queueModal('conflict');
    store.queueModal('conflict');
    store.queueModal('welcome');
    expect(names(store)).toEqual(['welcome']);
    expect(store.queue.map(entry => entry.name)).toEqual(['conflict']);

    store.closeAllModals();
    expect(names(store)).toEqual(['conflict']);
  });
});

describe('тост', () => {
  it('скрывается сам, тост с действием держится 10 секунд', () => {
    const store = useModalStore();
    store.showToast('saved');
    vi.advanceTimersByTime(4000);
    expect(store.toast).toBeNull();

    store.showToast('deleted', { actionText: 'undo', onAction: () => {} });
    vi.advanceTimersByTime(9000);
    expect(store.toast).not.toBeNull();
    vi.advanceTimersByTime(1000);
    expect(store.toast).toBeNull();
  });

  it('пауза при наведении останавливает отсчёт, после неё остаётся не меньше 2 секунд', () => {
    const store = useModalStore();
    store.showToast('saved');
    vi.advanceTimersByTime(3500);
    store.pauseToast();
    vi.advanceTimersByTime(60000);
    expect(store.toast).not.toBeNull();

    store.resumeToast();
    vi.advanceTimersByTime(1900);
    expect(store.toast).not.toBeNull();
    vi.advanceTimersByTime(100);
    expect(store.toast).toBeNull();
  });

  it('persistent остаётся, действие выполняется и скрывает тост', () => {
    const store = useModalStore();
    const onAction = vi.fn();
    store.showToast('update', { actionText: 'go', onAction, persistent: true });
    store.pauseToast();
    store.resumeToast();
    vi.advanceTimersByTime(60000);
    expect(store.toast).not.toBeNull();

    store.runToastAction();
    expect(onAction).toHaveBeenCalledOnce();
    expect(store.toast).toBeNull();
  });
});
