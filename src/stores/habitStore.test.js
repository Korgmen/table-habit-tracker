import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { setDoc } from 'firebase/firestore';
import { useHabitStore } from '@/stores/habitStore';

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

describe('applyScannedMarks', () => {
  it('переносит отметки с фото до сегодняшнего дня и пересчитывает прогресс', () => {
    const store = createStore(new Date(2026, 9, 3, 12), {
      '2026-10': { tasks: [task([false, false, false, ...Array(28).fill(null)])] },
    });
    store.applyScannedMarks([{ taskId: 1, rows: [Array(31).fill(true), Array(31).fill(true)] }]);

    expect(store.tasks[0].subtasks[0].marks.slice(0, 4)).toEqual([true, true, true, null]);
    expect(store.tasks[0].subtasks).toHaveLength(1);
    expect(store.tasks[0].progress).toBe(((3 / 31) * 100).toFixed(1));
    expect(JSON.parse(localStorage.getItem('habitArchive'))['2026-10'].tasks[0].progress).toBe(
      store.tasks[0].progress
    );
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
  it('битый JSON в localStorage не роняет старт и откладывается в резервную копию', () => {
    vi.setSystemTime(new Date(2026, 9, 4, 12));
    localStorage.setItem('habitArchive', '{broken');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setActivePinia(createPinia());
    const store = useHabitStore();
    expect(store.archive).toEqual({});
    expect(localStorage.getItem('habitArchiveBackup')).toBe('{broken');
  });

  it('заголовки из localStorage раскодируются при старте', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [{ ...task([]), title: 'A &amp;amp; B' }] },
    });
    expect(store.tasks[0].title).toBe('A & B');
  });

  it('импорт файла без архива возвращает ключ ошибки и не трогает данные', async () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    /** В jsdom у File нет text(), нужен только этот интерфейс */
    const file = { size: 10, text: async () => '{"foo": 1}' };
    expect(await store.importData(file)).toBe('import.invalid');
    expect(store.tasks).toHaveLength(1);
  });
});

describe('отметки', () => {
  it('cycleMark: пусто → выполнено → пропуск → пусто, будущие дни не меняются', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    const marks = () => store.tasks[0].subtasks[0].marks;
    store.cycleMark(1, 2, 0);
    expect(marks()[0]).toBe(true);
    store.cycleMark(1, 2, 0);
    expect(marks()[0]).toBe(false);
    store.cycleMark(1, 2, 0);
    expect(marks()[0]).toBeNull();
    store.cycleMark(1, 2, 10);
    expect(marks()[10]).toBeNull();
  });

  it('toggleSkip ставит и снимает пропуск', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task([true, ...Array(30).fill(null)])] },
    });
    store.toggleSkip(1, 2, 0);
    expect(store.tasks[0].subtasks[0].marks[0]).toBe(false);
    store.toggleSkip(1, 2, 0);
    expect(store.tasks[0].subtasks[0].marks[0]).toBeNull();
  });

  it('toggleDay проставляет день всем задачам, повторный клик очищает', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null)), task([true, ...Array(30).fill(null)], 5)] },
    });
    store.toggleDay(0, true);
    expect(store.tasks.every(t => t.subtasks[0].marks[0] === true)).toBe(true);
    store.toggleDay(0, true);
    expect(store.tasks.every(t => t.subtasks[0].marks[0] === null)).toBe(true);
  });
});

describe('задачи', () => {
  it('addTask создаёт задачу с подзадачами и соблюдает лимит', () => {
    const store = createStore(new Date(2026, 9, 4, 12));
    expect(store.addTask('  Чтение ', 3)).toBe(true);
    expect(store.tasks[0].title).toBe('Чтение');
    expect(store.tasks[0].subtasks).toHaveLength(3);
    expect(store.tasks[0].subtasks[0].marks).toHaveLength(31);
    expect(new Set(store.tasks[0].subtasks.map(s => s.id)).size).toBe(3);

    for (let i = 1; i < 20; i++) store.addTask('x');
    expect(store.addTask('over')).toBe(false);
  });

  it('updateTask переименовывает и обрезает подзадачи', () => {
    const store = createStore(new Date(2026, 9, 4, 12));
    store.addTask('A', 3);
    const id = store.tasks[0].id;
    store.updateTask(id, 'B', 1);
    expect(store.tasks[0]).toMatchObject({ title: 'B' });
    expect(store.tasks[0].subtasks).toHaveLength(1);
    store.updateTask(id, '   ', 2);
    expect(store.tasks[0].title).toBe('B');
    expect(store.tasks[0].subtasks).toHaveLength(2);
  });

  it('moveTask и восстановление удалённой задачи на прежнее место', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task([], 1), task([], 3), task([], 5)] },
    });
    store.moveTask(1, 1);
    expect(store.tasks.map(t => t.id)).toEqual([3, 1, 5]);
    store.moveTask(3, -1);
    expect(store.tasks.map(t => t.id)).toEqual([3, 1, 5]);

    const removed = store.deleteTask(1);
    expect(store.tasks.map(t => t.id)).toEqual([3, 5]);
    expect(store.restoreTask(removed)).toBe(true);
    expect(store.tasks.map(t => t.id)).toEqual([3, 1, 5]);
  });

  it('удалённую задачу нельзя вернуть в другой месяц', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task([], 1)] },
    });
    const removed = store.deleteTask(1);
    store.prevMonth();
    expect(store.restoreTask(removed)).toBe(false);
    expect(store.tasks).toHaveLength(0);
  });

  it('duplicateToCurrent копирует задачи архива в текущий месяц без отметок', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-09': { tasks: [task(Array(30).fill(true))] },
    });
    store.prevMonth();
    store.duplicateToCurrent();
    expect(store.currentMonthKey).toBe('2026-10');
    expect(store.tasks[0].title).toBe('Task');
    expect(store.tasks[0].subtasks[0].marks).toEqual(Array(31).fill(null));
    expect(store.archive['2026-09'].tasks[0].subtasks[0].marks[0]).toBe(true);
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
