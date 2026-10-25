import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { setDoc } from 'firebase/firestore';
import { useHabitStore, isValidArchive } from '@/stores/habitStore';

vi.mock('@/firebase', () => ({ auth: {}, provider: {}, db: {} }));
vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
}));

const task = (marks, id = 1) => ({
  id,
  title: 'Task',
  progress: 0,
  subtasks: [{ id: id + 1, marks }],
});

/** Стор на заданную дату; архив кладётся в localStorage до создания */
const createStore = (now, archive) => {
  vi.setSystemTime(now);
  if (archive) localStorage.setItem('habitArchive', JSON.stringify(archive));
  setActivePinia(createPinia());
  return useHabitStore();
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.mocked(setDoc).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('updateTaskProgress', () => {
  const marks = [true, null, false, true, ...Array(27).fill(null)];

  it('fullMonth: пропуск не учитывается, будущие дни считаются невыполненными', () => {
    const store = createStore(new Date(2026, 9, 4, 12), { '2026-10': { tasks: [task(marks)] } });
    store.updateTaskProgress(1);
    expect(store.tasks[0].progress).toBe(((2 / 30) * 100).toFixed(1));
  });

  it('passedDays: учитываются только дни до сегодняшнего включительно', () => {
    const store = createStore(new Date(2026, 9, 4, 12), { '2026-10': { tasks: [task(marks)] } });
    store.setCalculationMode('passedDays');
    expect(store.tasks[0].progress).toBe(((2 / 3) * 100).toFixed(1));
  });

  it('задача без подзадач получает 0', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [{ id: 1, title: 'T', progress: '50.0', subtasks: [] }] },
    });
    store.updateTaskProgress(1);
    expect(store.tasks[0].progress).toBe(0);
  });
});

describe('навигация по месяцам на 31-е число', () => {
  it('prevMonth с 31 октября ведёт в сентябрь, nextMonth возвращает в октябрь', () => {
    const store = createStore(new Date(2026, 9, 31, 12));
    store.prevMonth();
    expect(store.currentMonthKey).toBe('2026-09');
    store.nextMonth();
    expect(store.currentMonthKey).toBe('2026-10');
  });

  it('nextMonth не уходит дальше реального месяца', () => {
    const store = createStore(new Date(2026, 9, 31, 12));
    store.nextMonth();
    expect(store.currentMonthKey).toBe('2026-10');
  });

  it('prevMonth с 31 марта ведёт в февраль', () => {
    const store = createStore(new Date(2026, 2, 31, 12));
    store.prevMonth();
    expect(store.currentMonthKey).toBe('2026-02');
  });
});

describe('adaptMarksToNewMonth', () => {
  it('обрезает отметки 31-дневного месяца до 28 дней февраля', () => {
    const marks = Array.from({ length: 31 }, (_, i) => (i % 2 === 0 ? true : null));
    const store = createStore(new Date(2026, 1, 15, 12), {
      '2026-02': { tasks: [task(marks)] },
    });
    store.adaptMarksToNewMonth();
    expect(store.tasks[0].subtasks[0].marks).toEqual(marks.slice(0, 28));
  });

  it('дополняет короткий массив отметок значениями null', () => {
    const store = createStore(new Date(2026, 0, 15, 12), {
      '2026-01': { tasks: [task([true, false])] },
    });
    store.adaptMarksToNewMonth();
    const result = store.tasks[0].subtasks[0].marks;
    expect(result).toHaveLength(31);
    expect(result.slice(0, 3)).toEqual([true, false, null]);
  });
});

describe('архив', () => {
  it('isValidArchive принимает корректный архив', () => {
    expect(isValidArchive({ '2026-10': { tasks: [task([true, null, false])] } })).toBe(true);
    expect(isValidArchive({})).toBe(true);
  });

  it('isValidArchive отклоняет битую структуру', () => {
    expect(isValidArchive(null)).toBe(false);
    expect(isValidArchive([])).toBe(false);
    expect(isValidArchive({ october: { tasks: [] } })).toBe(false);
    expect(isValidArchive({ '2026-13': { tasks: [] } })).toBe(false);
    expect(isValidArchive({ '2026-10': { tasks: {} } })).toBe(false);
    expect(isValidArchive({ '2026-10': { tasks: [{ title: 'T', subtasks: null }] } })).toBe(false);
    expect(isValidArchive({ '2026-10': { tasks: [task([1, 'x'])] } })).toBe(false);
  });

  it('битый JSON в localStorage не роняет старт и откладывается в резервную копию', () => {
    vi.setSystemTime(new Date(2026, 9, 4, 12));
    localStorage.setItem('habitArchive', '{broken');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setActivePinia(createPinia());
    const store = useHabitStore();
    expect(store.archive).toEqual({});
    expect(localStorage.getItem('habitArchiveBackup')).toBe('{broken');
  });
});

describe('синхронизация', () => {
  it('серия отметок уходит в Firestore одной записью', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    store.user = { uid: 'u1' };
    store.isAuthReady = true;

    store.updateMark(1, 2, 0, true);
    store.updateMark(1, 2, 1, true);
    store.updateHeaderDay(2, false);
    expect(setDoc).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('настройки из облака применяются только с допустимыми значениями', () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    store.applyCloudData({
      archive: {},
      settings: { theme: 'dark', weekStart: 'friday', calculationMode: 'passedDays', user: 'x' },
    });
    expect(store.theme).toBe('dark');
    expect(store.weekStart).toBe('monday');
    expect(store.calculationMode).toBe('passedDays');
    expect(store.user).toBe(null);
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});

describe('очередь модальных окон', () => {
  it('окно, открытое поверх другого, ждёт его закрытия', () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    store.showModal({ type: 'confirm', title: 'conflict' });
    store.showModal({ type: 'confirm', title: 'update' });
    expect(store.modal.title).toBe('conflict');

    store.closeModal();
    expect(store.modal.isOpen).toBe(true);
    expect(store.modal.title).toBe('update');

    store.closeModal();
    expect(store.modal.isOpen).toBe(false);
  });
});

describe('syncRealDate', () => {
  it('после полуночи разрешает отметить новый день', () => {
    const store = createStore(new Date(2026, 9, 10, 23, 59), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    expect(store.today).toBe(10);
    vi.setSystemTime(new Date(2026, 9, 11, 0, 1));
    store.syncRealDate();
    expect(store.today).toBe(11);
  });

  it('при смене месяца переключается с реального месяца на новый', () => {
    const store = createStore(new Date(2026, 9, 31, 23, 59), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    vi.setSystemTime(new Date(2026, 10, 1, 0, 1));
    store.syncRealDate();
    expect(store.currentMonthKey).toBe('2026-11');
    expect(store.tasks).toEqual([]);
    expect(store.archive['2026-10'].tasks).toHaveLength(1);
  });

  it('прошлый месяц, открытый для просмотра, остаётся на месте', () => {
    const store = createStore(new Date(2026, 9, 31, 23, 59));
    store.prevMonth();
    vi.setSystemTime(new Date(2026, 10, 1, 0, 1));
    store.syncRealDate();
    expect(store.currentMonthKey).toBe('2026-09');
  });
});
