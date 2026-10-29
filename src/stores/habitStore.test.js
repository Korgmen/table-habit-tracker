import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { getDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useHabitStore } from '@/stores/habitStore';
import { hashTasks, carryId } from '@/utils/archive';

/** Пакетные записи Firestore: fs.commit(ops) получает операции { path, data, options } */
const fs = vi.hoisted(() => ({ commit: null }));

vi.mock('@/firebase', () => ({ auth: {}, provider: {}, db: {} }));
vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  collection: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  writeBatch: vi.fn(() => {
    const ops = [];
    return {
      set: (ref, data, options) =>
        ops.push({ path: ref.path, data: JSON.parse(JSON.stringify(data)), options }),
      commit: () => fs.commit(ops),
    };
  }),
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
  fs.commit = vi.fn(() => Promise.resolve());
  vi.mocked(getDoc).mockReset();
  vi.mocked(getDocs).mockReset();
  vi.mocked(onSnapshot).mockClear();
  vi.mocked(signOut).mockClear();
});

/** Вошедший пользователь с прочитанным облаком */
const signIn = store => {
  store.user = { uid: 'u1' };
  store.isAuthReady = true;
};

/** Облако для connectCloud: корневой документ и документы месяцев */
const setCloud = ({ root = null, months = {} } = {}) => {
  vi.mocked(getDoc).mockResolvedValue({ exists: () => !!root, data: () => root });
  vi.mocked(getDocs).mockResolvedValue({
    forEach: callback =>
      Object.entries(months).forEach(([id, data]) => callback({ id, data: () => data })),
  });
};

/** Операции пакетной записи номер index */
const commitOps = index => fs.commit.mock.calls[index][0];
const monthOp = (ops, key) => ops.find(op => op.path === `users/u1/months/${key}`);
const rootOp = ops => ops.find(op => op.path === 'users/u1');
/** Операции всех записей подряд */
const allOps = () => fs.commit.mock.calls.flatMap(([ops]) => ops);

/** Изменение месяца из подписки onSnapshot */
const monthChange = (key, data) => ({
  type: 'modified',
  doc: {
    id: key,
    data: () => data,
    metadata: { hasPendingWrites: false, fromCache: false },
  },
});

/** Файл импорта: в jsdom у File нет text(), нужен только этот интерфейс */
const fileOf = data => {
  const text = JSON.stringify(data);
  return { size: text.length, text: async () => text };
};

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
    vi.advanceTimersByTime(300);
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
    expect(await store.readImportFile(fileOf({ foo: 1 }))).toBe('import.invalid');
    expect(store.pendingImport).toBe(null);
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

    expect(store.deleteTask(1)).toBe(true);
    expect(store.tasks.map(t => t.id)).toEqual([3, 5]);
    store.undo();
    expect(store.tasks.map(t => t.id)).toEqual([3, 1, 5]);
  });

  it('отмена удаления из другого месяца возвращает задачу и открывает её месяц', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task([], 1)] },
    });
    store.deleteTask(1);
    const id = store.lastChangeId;
    store.prevMonth();
    expect(store.undoTo(id)).toBe(true);
    expect(store.currentMonthKey).toBe('2026-10');
    expect(store.tasks.map(t => t.id)).toEqual([1]);
  });

  it('новые задачи и подзадачи получают UUID, название обрезается до лимита', () => {
    const store = createStore(new Date(2026, 9, 4, 12));
    store.addTask('x'.repeat(80), 2);
    const [created] = store.tasks;
    expect(created.title).toHaveLength(60);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.subtasks.map(s => s.id)).toEqual([
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    ]);
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

  it('прошлый месяц, открытый для просмотра, остаётся на месте', () => {
    const store = createStore(new Date(2026, 9, 31, 23, 59));
    store.prevMonth();
    vi.setSystemTime(new Date(2026, 10, 1, 0, 1));
    store.syncRealDate();
    expect(store.currentMonthKey).toBe('2026-09');
  });
});

describe('история', () => {
  it('undo и redo по отметкам, новая правка очищает redo', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    const marks = () => store.tasks[0].subtasks[0].marks;
    store.cycleMark(1, 2, 0);
    store.cycleMark(1, 2, 1);
    expect(store.undo()).toBe('mark');
    expect(marks().slice(0, 2)).toEqual([true, null]);
    expect(store.redo()).toBe('mark');
    expect(marks().slice(0, 2)).toEqual([true, true]);

    store.undo();
    store.cycleMark(1, 2, 2);
    expect(store.canRedo).toBe(false);
    expect(store.undoStack).toHaveLength(2);
  });

  it('отмена отметки дня возвращает ручные пропуски', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task([false, ...Array(30).fill(null)]), task(Array(31).fill(null), 5)] },
    });
    store.toggleDay(0, true);
    expect(store.tasks.map(t => t.subtasks[0].marks[0])).toEqual([true, true]);
    store.undo();
    expect(store.tasks.map(t => t.subtasks[0].marks[0])).toEqual([false, null]);
    expect(store.tasks[0].progress).toBe(((0 / 30) * 100).toFixed(1));
  });

  it('отмена уменьшения подзадач возвращает их отметки', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': {
        tasks: [
          {
            ...task([true, ...Array(30).fill(null)]),
            subtasks: [
              { id: 2, marks: Array(31).fill(null) },
              { id: 3, marks: [true, ...Array(30).fill(null)] },
            ],
          },
        ],
      },
    });
    store.updateTask(1, 'Task', 1);
    expect(store.tasks[0].subtasks).toHaveLength(1);
    store.undo();
    expect(store.tasks[0].subtasks[1]).toEqual({ id: 3, marks: [true, ...Array(30).fill(null)] });
  });

  it('отмена переноса месяца возвращает прежний список и вид архивного месяца', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-09': { tasks: [task(Array(30).fill(true))] },
      '2026-10': { tasks: [task(Array(31).fill(null), 7)] },
    });
    store.prevMonth();
    store.carryOver('2026-09');
    expect(store.currentMonthKey).toBe('2026-10');
    store.undo();
    expect(store.currentMonthKey).toBe('2026-09');
    expect(store.archive['2026-10'].tasks.map(t => t.id)).toEqual([7]);
  });

  it('перетаскивание без смены порядка не попадает в историю', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task([], 1), task([], 3)] },
    });
    store.reorderTasks([...store.tasks]);
    expect(store.canUndo).toBe(false);
    store.reorderTasks([store.tasks[1], store.tasks[0]]);
    expect(store.tasks.map(t => t.id)).toEqual([3, 1]);
    store.undo();
    expect(store.tasks.map(t => t.id)).toEqual([1, 3]);
  });

  it('история ограничена 50 шагами', () => {
    const store = createStore(new Date(2026, 9, 31, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    for (let i = 0; i < 31; i++) store.cycleMark(1, 2, i);
    for (let i = 0; i < 31; i++) store.cycleMark(1, 2, i);
    expect(store.undoStack).toHaveLength(50);
  });
});

describe('импорт', () => {
  const current = { '2026-09': { tasks: [task(Array(30).fill(true))] } };

  it('файл новой версии с настройками заменяет архив и делает резервную копию', async () => {
    const store = createStore(new Date(2026, 9, 4, 12), current);
    const file = fileOf({
      schemaVersion: 2,
      settings: { theme: 'dark', weekStart: 'friday' },
      archive: { '2026-10': { tasks: [task(Array(31).fill(null), 9)] } },
    });
    expect(await store.readImportFile(file)).toBe(null);
    store.applyImport({ replace: true });

    expect(Object.keys(store.archive).sort()).toEqual(['2026-10']);
    expect(store.tasks.map(t => t.id)).toEqual([9]);
    expect(store.theme).toBe('dark');
    expect(store.weekStart).toBe('monday');
    expect(JSON.parse(localStorage.getItem('habitArchiveBackup'))).toEqual(current);
    expect(store.backupAt).toBeGreaterThan(0);

    store.undo();
    expect(store.archive['2026-09'].tasks).toHaveLength(1);
    expect(store.archive['2026-10']?.tasks || []).toEqual([]);
    expect(store.theme).toBe('system');
  });

  it('слияние добавляет месяцы, совпавший месяц берётся из файла только по выбору', async () => {
    const store = createStore(new Date(2026, 9, 4, 12), current);
    const file = fileOf({
      '2026-08': { tasks: [task(Array(31).fill(null), 3)] },
      '2026-09': { tasks: [task(Array(30).fill(null), 5)] },
    });
    await store.readImportFile(file);
    store.applyImport({ replace: false });
    expect(store.archive['2026-08'].tasks[0].id).toBe(3);
    expect(store.archive['2026-09'].tasks[0].id).toBe(1);

    await store.readImportFile(file);
    store.applyImport({ replace: false, takeIncoming: ['2026-09'] });
    expect(store.archive['2026-09'].tasks[0].id).toBe(5);
  });

  it('отклоняет пустой файл, файл новее приложения и превышение лимитов', async () => {
    const store = createStore(new Date(2026, 9, 4, 12));
    expect(await store.readImportFile(fileOf({}))).toBe('import.empty');
    expect(await store.readImportFile(fileOf({ schemaVersion: 99, archive: {} }))).toBe(
      'import.newer'
    );
    const many = Array.from({ length: 21 }, (_, i) => task([], i * 2));
    expect(await store.readImportFile(fileOf({ '2026-10': { tasks: many } }))).toBe(
      'import.invalid'
    );
    expect(await store.readImportFile({ size: 10, text: async () => '{broken' })).toBe(
      'import.invalid'
    );
  });

  it('длинные названия из старых версий обрезаются, повторные id заменяются', async () => {
    const store = createStore(new Date(2026, 9, 4, 12));
    const file = fileOf({
      '2026-10': { tasks: [{ ...task([]), title: 'x'.repeat(70) }, task([])] },
    });
    await store.readImportFile(file);
    expect(store.pendingImport.truncated).toBe(1);
    const [first, second] = store.pendingImport.archive['2026-10'].tasks;
    expect(first.title).toHaveLength(60);
    expect(second.id).not.toBe(first.id);
  });

  it('резервная копия восстанавливается через окно импорта', () => {
    localStorage.setItem('habitArchiveBackup', JSON.stringify(current));
    const store = createStore(new Date(2026, 9, 4, 12));
    expect(store.backupAt).toBe(0);
    expect(store.readBackup()).toBe(null);
    expect(store.pendingImport.source).toBe('backup');
    localStorage.setItem('habitArchiveBackup', '{broken');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(store.readBackup()).toBe('backup.invalid');
  });
});

describe('localStorage', () => {
  it('серия правок пишется одной записью, переполнение сообщается', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    store.cycleMark(1, 2, 0);
    store.cycleMark(1, 2, 1);
    expect(setItem).not.toHaveBeenCalled();
    store.flushLocalSave();
    expect(setItem.mock.calls.filter(([key]) => key === 'habitArchive')).toHaveLength(1);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    setItem.mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    store.cycleMark(1, 2, 2);
    vi.advanceTimersByTime(300);
    expect(store.localSaveError).toBe('quota');
    setItem.mockRestore();
  });
});

describe('настройки привычки', () => {
  it('addTask и updateTask сохраняют поля, undefined убирает поле, без изменений истории нет', () => {
    const store = createStore(new Date(2026, 9, 4, 12));
    store.addTask('A', 1, { color: 'blue', emoji: '📚', schedule: [1, 3], goal: undefined });
    const [created] = store.tasks;
    expect(created).toMatchObject({ color: 'blue', emoji: '📚', schedule: [1, 3] });
    expect(created).not.toHaveProperty('goal');

    const steps = store.undoStack.length;
    store.updateTask(created.id, 'A', 1, { color: 'blue', emoji: '📚', schedule: [1, 3] });
    expect(store.undoStack).toHaveLength(steps);

    store.updateTask(created.id, 'A', 1, { color: undefined, schedule: undefined, goal: 2 });
    expect(store.tasks[0]).toMatchObject({ emoji: '📚', goal: 2 });
    expect(store.tasks[0]).not.toHaveProperty('color');
    expect(store.tasks[0]).not.toHaveProperty('schedule');
    store.undo();
    expect(store.tasks[0]).toMatchObject({ color: 'blue', schedule: [1, 3] });
  });

  it('расписание и цель пересчитывают прогресс, начало недели тоже', () => {
    /** 1–4 октября 2026: чт, пт, сб, вс */
    const marks = [true, null, null, null, ...Array(27).fill(null)];
    const store = createStore(new Date(2026, 9, 4, 12), { '2026-10': { tasks: [task(marks)] } });
    store.setCalculationMode('passedDays');
    expect(store.tasks[0].progress).toBe('25.0');

    store.updateTask(1, 'Task', 1, { schedule: [4] });
    expect(store.tasks[0].subtasks[0].marks.slice(0, 8)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      null,
    ]);
    expect(store.tasks[0].progress).toBe('100.0');
    store.undo();
    expect(store.tasks[0].subtasks[0].marks[1]).toBe(null);
    store.redo();

    /** Недели с воскресенья: 1–3 октября – цель набрана, 2–3 закрыты пропуском;
     *  4-е – новая неделя, цель 1/7 не набрана */
    store.setWeekStart('sunday');
    store.updateTask(1, 'Task', 1, { schedule: undefined, goal: 1 });
    expect(store.tasks[0].subtasks[0].marks.slice(0, 4)).toEqual([true, false, false, null]);
    expect(store.tasks[0].progress).toBe('50.0');
    /** С понедельника 1–4 октября – одна неделя, её цель набрана */
    store.setWeekStart('monday');
    expect(store.tasks[0].progress).toBe('100.0');
  });

  it('цель недели набрана – пустые дни недели закрываются, перестала – открываются', () => {
    /** 5–11 октября 2026 – неделя с понедельника */
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [{ ...task(Array(31).fill(null)), goal: 2 }] },
    });
    const marks = () => store.tasks[0].subtasks[0].marks;
    store.updateMark(1, 2, 4, true);
    expect(marks().slice(4, 11)).toEqual([true, ...Array(6).fill(null)]);
    store.updateMark(1, 2, 5, true);
    expect(marks().slice(4, 11)).toEqual([true, true, false, false, false, false, false]);
    expect(marks()[11]).toBe(null);

    /** Снятый вручную пропуск в набранной неделе не возвращается */
    store.cycleMark(1, 2, 6);
    expect(marks()[6]).toBe(null);
    store.updateMark(1, 2, 3, true);
    expect(marks()[6]).toBe(null);

    store.updateMark(1, 2, 5, null);
    expect(marks().slice(4, 11)).toEqual([true, null, null, null, null, null, null]);
    store.undo();
    expect(marks().slice(4, 11)).toEqual([true, true, null, false, false, false, false]);
  });

  it('привычка на паузе не входит в общий процент, пауза отменяется', () => {
    const store = createStore(new Date(2026, 9, 1, 12), {
      '2026-10': {
        tasks: [task([true, ...Array(30).fill(null)]), task(Array(31).fill(null), 5)],
      },
    });
    store.setCalculationMode('passedDays');
    expect(store.overallProgress).toBe('50.0');
    store.togglePause(5);
    expect(store.tasks[1].paused).toBe(true);
    expect(store.overallProgress).toBe('100.0');
    store.undo();
    expect(store.tasks[1]).not.toHaveProperty('paused');
  });
});

describe('заметки', () => {
  it('ставятся до сегодня включительно, пустой текст удаляет, отменяются', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    expect(store.setNote(1, 3, '  Бег 5 км ')).toBe(true);
    expect(store.tasks[0].notes).toEqual({ 3: 'Бег 5 км' });
    expect(store.setNote(1, 4, 'завтра')).toBe(false);
    expect(store.setNote(1, 0, 'x'.repeat(900))).toBe(true);
    expect(store.tasks[0].notes[0]).toHaveLength(500);

    store.setNote(1, 3, '');
    expect(store.tasks[0].notes).toEqual({ 0: 'x'.repeat(500) });
    store.setNote(1, 0, ' ');
    expect(store.tasks[0]).not.toHaveProperty('notes');
    store.undo();
    store.undo();
    expect(store.tasks[0].notes[3]).toBe('Бег 5 км');
  });

  it('заметки за дни, которых нет в месяце, убираются при подгонке', () => {
    const store = createStore(new Date(2026, 1, 15, 12), {
      '2026-02': { tasks: [{ ...task(Array(31).fill(null)), notes: { 1: 'a', 29: 'b' } }] },
    });
    store.adaptMarksToNewMonth();
    expect(store.tasks[0].notes).toEqual({ 1: 'a' });
  });
});

describe('перенос в новый месяц', () => {
  const source = () => ({
    ...task([true, ...Array(29).fill(false)], 1),
    color: 'green',
    schedule: [1, 2],
    paused: true,
    notes: { 0: 'x' },
  });

  it('автоперенос берёт последний месяц с привычками, id одинаковы на всех устройствах', () => {
    const store = createStore(new Date(2026, 10, 1, 9), {
      '2026-09': { tasks: [source()] },
    });
    store.autoCarryOver();
    expect(store.tasks).toHaveLength(1);
    expect(store.tasks[0]).toMatchObject({
      id: carryId('2026-11', 1, null),
      title: 'Task',
      color: 'green',
      schedule: [1, 2],
      paused: true,
    });
    /** 1 ноября 2026 – воскресенье: расписание пн, вт, остальные дни – пропуски */
    expect(store.tasks[0].subtasks[0]).toEqual({
      id: carryId('2026-11', 1, 0),
      marks: Array.from({ length: 30 }, (_, i) => ([1, 2].includes(i % 7) ? null : false)),
    });
    expect(store.tasks[0]).not.toHaveProperty('notes');
    expect(store.lastCarry).toMatchObject({ from: '2026-09', count: 1 });

    store.undo();
    expect(store.tasks).toEqual([]);
    store.autoCarryOver();
    expect(store.tasks).toEqual([]);
  });

  it('автоперенос не срабатывает в архивном и уже открытом месяце', () => {
    const store = createStore(new Date(2026, 10, 1, 9), {
      '2026-10': { tasks: [source()] },
      '2026-11': { tasks: [] },
    });
    store.autoCarryOver();
    expect(store.tasks).toEqual([]);
  });

  it('смена месяца в открытом приложении переносит привычки', () => {
    const store = createStore(new Date(2026, 9, 31, 23, 59), {
      '2026-10': { tasks: [task(Array(31).fill(true))] },
    });
    vi.setSystemTime(new Date(2026, 10, 1, 0, 1));
    store.syncRealDate();
    expect(store.currentMonthKey).toBe('2026-11');
    expect(store.tasks[0].subtasks[0].marks).toEqual(Array(30).fill(null));
    expect(store.archive['2026-10'].tasks[0].subtasks[0].marks[0]).toBe(true);
  });

  it('ручной перенос: выбранные привычки, замена или добавление, лимит', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-09': { tasks: [source(), task(Array(30).fill(null), 3)] },
      '2026-10': { tasks: [task(Array(31).fill(null), 7)] },
    });
    expect(store.carryOver('2026-09', { taskIds: [3], replace: false })).toBe(true);
    expect(store.currentMonthKey).toBe('2026-10');
    expect(store.tasks.map(t => t.id)[0]).toBe(7);
    expect(store.tasks).toHaveLength(2);

    expect(store.carryOver('2026-09')).toBe(true);
    expect(store.tasks).toHaveLength(2);
    expect(store.tasks[0]).toMatchObject({ title: 'Task', color: 'green' });
    expect(store.tasks[0].id).not.toBe(1);

    store.archive['2026-09'].tasks = Array.from({ length: 19 }, (_, i) => task([], 100 + i * 2));
    expect(store.carryOver('2026-09', { replace: false })).toBe(false);
    expect(store.carryOver('2026-10')).toBe(false);
  });
});

describe('экспорт CSV', () => {
  it('сохраняет месяц или весь архив файлом с датой', () => {
    const store = createStore(new Date(2026, 9, 4, 12), {
      '2026-09': { tasks: [task(Array(30).fill(true))] },
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const labels = { month: 'M', habit: 'H', mark: '#', progress: '%', notes: 'N' };
    expect(store.exportCsv('month', labels)).toBe('habit_2026-10_2026-10-04.csv');
    expect(store.exportCsv('all', labels)).toBe('habit_data_2026-10-04.csv');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });
});

describe('облако', () => {
  it('серия отметок уходит одной пакетной записью: месяц и корень', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    signIn(store);

    store.updateMark(1, 2, 0, true);
    store.updateMark(1, 2, 1, true);
    store.updateHeaderDay(2, false);
    expect(fs.commit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(fs.commit).toHaveBeenCalledTimes(1);
    const ops = commitOps(0);
    expect(monthOp(ops, '2026-10').data).toMatchObject({ revision: 1, base: 0 });
    expect(monthOp(ops, '2026-10').data.tasks[0].subtasks[0].marks.slice(0, 3)).toEqual([
      true,
      true,
      false,
    ]);
    expect(rootOp(ops)).toMatchObject({ data: { schemaVersion: 2 }, options: { merge: true } });
  });

  it('пишутся только изменённые месяцы, ревизия растёт от известной', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-09': { tasks: [task(Array(30).fill(true), 7)] },
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    signIn(store);
    await store.saveToCloud();
    expect(commitOps(0).filter(op => op.path.includes('/months/'))).toHaveLength(2);

    store.updateMark(1, 2, 0, true);
    await vi.advanceTimersByTimeAsync(1000);
    const ops = commitOps(1);
    expect(ops.map(op => op.path)).toEqual(['users/u1/months/2026-10']);
    expect(monthOp(ops, '2026-10').data).toMatchObject({ revision: 2, base: 1 });

    store.updateMark(1, 2, 0, true);
    await store.flushCloudSave();
    expect(fs.commit).toHaveBeenCalledTimes(2);
  });

  it('правки во время записи уходят следующей записью, а не параллельно', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    signIn(store);
    let finish;
    fs.commit.mockImplementationOnce(() => new Promise(resolve => (finish = resolve)));

    store.updateMark(1, 2, 0, true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.syncState).toBe('saving');
    store.updateMark(1, 2, 1, true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fs.commit).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(fs.commit).toHaveBeenCalledTimes(2);
    expect(monthOp(commitOps(1), '2026-10').data).toMatchObject({ revision: 2, base: 1 });
    expect(monthOp(commitOps(1), '2026-10').data.tasks[0].subtasks[0].marks[1]).toBe(true);
    expect(store.syncState).toBe('synced');
  });

  it('ошибка записи видна в статусе и повторяется с паузой', async () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    signIn(store);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fs.commit.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'internal' }));

    expect(await store.saveToCloud()).toBe(false);
    expect(store.syncState).toBe('error');
    expect(store.syncError).toBe('internal');

    await vi.advanceTimersByTimeAsync(2000);
    expect(fs.commit).toHaveBeenCalledTimes(2);
    expect(store.syncState).toBe('synced');
    expect(store.syncError).toBe(null);
  });

  it('отказ в доступе не повторяется сам', async () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    signIn(store);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fs.commit.mockRejectedValueOnce({ code: 'permission-denied' });
    await store.saveToCloud();
    await vi.advanceTimersByTimeAsync(60000);
    expect(fs.commit).toHaveBeenCalledTimes(1);
    expect(store.syncError).toBe('permission-denied');
  });

  it('слишком большой документ месяца не отправляется', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [{ ...task(Array(31).fill(null)), title: 'x'.repeat(1100000) }] },
    });
    signIn(store);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await store.saveToCloud();
    expect(fs.commit).not.toHaveBeenCalled();
    expect(store.syncError).toBe('too-large');
  });

  it('новый пользователь: данные устройства уходят в облако, подписка включается', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    store.user = { uid: 'u1' };
    setCloud();
    await store.connectCloud();

    expect(store.isAuthReady).toBe(true);
    expect(onSnapshot).toHaveBeenCalledTimes(2);
    const ops = commitOps(0);
    expect(monthOp(ops, '2026-10').data.revision).toBe(1);
    expect(rootOp(ops).data.schemaVersion).toBe(2);
    expect(store.syncState).toBe('synced');
  });

  it('миграция старого документа: месяцы пишутся в подколлекцию, поле archive не удаляется', async () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    store.user = { uid: 'u1' };
    const legacyTasks = [task([true, ...Array(30).fill(null)], 5)];
    setCloud({
      root: {
        archive: { '2026-10': { tasks: legacyTasks }, '2026-09': { tasks: [task([], 9)] } },
        settings: { theme: 'dark', weekStart: 'friday' },
        updatedAt: 1,
      },
    });
    await store.connectCloud();

    expect(store.cloudConflict).toBe(null);
    expect(store.tasks[0].id).toBe(5);
    expect(store.theme).toBe('dark');
    expect(store.weekStart).toBe('monday');
    const ops = commitOps(0);
    expect(monthOp(ops, '2026-10').data).toMatchObject({
      revision: 1,
      legacyHash: hashTasks(legacyTasks),
      legacyRevision: 1,
    });
    expect(monthOp(ops, '2026-09')).toBeDefined();
    expect(rootOp(ops).options).toEqual({ merge: true });
    expect(rootOp(ops).data).not.toHaveProperty('archive');
  });

  it('при входе расходятся только месяцы, изменённые с обеих сторон', async () => {
    const synced = [task(Array(31).fill(null))];
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-08': { tasks: synced },
      '2026-09': { tasks: synced },
      '2026-10': { tasks: [task(Array(31).fill(true))] },
    });
    localStorage.setItem(
      'habitSyncMeta',
      JSON.stringify({
        uid: 'u1',
        months: Object.fromEntries(
          ['2026-08', '2026-09', '2026-10'].map(key => [
            key,
            { revision: 2, hash: hashTasks(synced) },
          ])
        ),
        settingsHash: null,
        legacy: {},
      })
    );
    store.user = { uid: 'u1' };
    setCloud({
      root: { schemaVersion: 2, settings: {} },
      months: {
        '2026-08': { tasks: [task(Array(31).fill(false), 5)], revision: 3, base: 2 },
        '2026-09': { tasks: synced, revision: 2 },
        '2026-10': { tasks: [task(Array(31).fill(false), 7)], revision: 5, base: 2 },
      },
    });
    await store.connectCloud();

    expect(store.archive['2026-08'].tasks[0].id).toBe(5);
    expect(Object.keys(store.cloudConflict.months)).toEqual(['2026-10']);
    expect(store.syncState).toBe('conflict');
    expect(allOps().filter(op => op.path.includes('/months/'))).toEqual([]);

    store.resolveCloudConflict({ '2026-10': 'local' });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.cloudConflict).toBe(null);
    const month = monthOp(allOps(), '2026-10').data;
    expect(month).toMatchObject({ revision: 6, base: 5 });
    expect(month.tasks[0].subtasks[0].marks[0]).toBe(true);
    expect(store.syncState).toBe('synced');
  });

  it('запись старого клиента после миграции вливается в месяцы', async () => {
    const before = [task(Array(31).fill(null))];
    const changed = [task([true, ...Array(30).fill(null)])];
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-09': { tasks: before },
      '2026-10': { tasks: before },
    });
    localStorage.setItem(
      'habitSyncMeta',
      JSON.stringify({
        uid: 'u1',
        months: {
          '2026-09': { revision: 4, hash: hashTasks(before) },
          '2026-10': { revision: 6, hash: hashTasks(before) },
        },
        settingsHash: null,
        legacy: {},
      })
    );
    store.user = { uid: 'u1' };
    const legacyFields = { legacyHash: hashTasks(before), legacyRevision: 4 };
    setCloud({
      root: {
        archive: { '2026-09': { tasks: changed }, '2026-10': { tasks: changed } },
        settings: {},
        updatedAt: 2,
      },
      months: {
        '2026-09': { tasks: before, revision: 4, ...legacyFields },
        '2026-10': { tasks: before, revision: 6, ...legacyFields },
      },
    });
    await store.connectCloud();

    expect(store.archive['2026-09'].tasks[0].subtasks[0].marks[0]).toBe(true);
    expect(store.cloudConflict.months['2026-10'].source).toBe('legacy');
    const month = monthOp(commitOps(0), '2026-09').data;
    expect(month).toMatchObject({ revision: 6, legacyHash: hashTasks(changed), legacyRevision: 6 });
    expect(rootOp(commitOps(0)).data.schemaVersion).toBe(2);
  });

  it('изменение с другого устройства: чистый месяц обновляется, с правками – конфликт', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-09': { tasks: [task(Array(30).fill(null), 7)] },
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    signIn(store);
    await store.saveToCloud();

    const remote = [task([true, ...Array(30).fill(null)])];
    store.handleMonthChange(
      monthChange('2026-10', { tasks: remote, revision: 2, base: 1, deviceId: 'other' })
    );
    expect(store.tasks[0].subtasks[0].marks[0]).toBe(true);
    await store.flushCloudSave();
    expect(fs.commit).toHaveBeenCalledTimes(1);

    store.updateMark(1, 2, 1, true);
    store.handleMonthChange(
      monthChange('2026-10', { tasks: remote, revision: 3, base: 2, deviceId: 'other' })
    );
    expect(store.cloudConflict).toBe(null);
    store.handleMonthChange(
      monthChange('2026-10', {
        tasks: [task(Array(31).fill(false))],
        revision: 4,
        base: 3,
        deviceId: 'other',
      })
    );
    expect(Object.keys(store.cloudConflict.months)).toEqual(['2026-10']);
    expect(store.tasks[0].subtasks[0].marks[1]).toBe(true);

    /** Месяц в конфликте не пишется, остальные – да */
    store.updateMark(7, 8, 0, true);
    store.prevMonth();
    store.updateMark(7, 8, 0, true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(commitOps(1).map(op => op.path)).toEqual(['users/u1/months/2026-09']);

    store.resolveCloudConflict(false);
    expect(store.archive['2026-10'].tasks[0].subtasks[0].marks[0]).toBe(false);
    store.undo();
    expect(store.archive['2026-10'].tasks[0].subtasks[0].marks[1]).toBe(true);
  });

  it('повреждённый облачный месяц нельзя загрузить, только перезаписать', async () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    store.user = { uid: 'u1' };
    setCloud({ root: { schemaVersion: 2 }, months: { '2026-10': { tasks: [{ title: 5 }] } } });
    await store.connectCloud();
    expect(store.cloudConflict.months['2026-10'].tasks).toBe(null);
    store.resolveCloudConflict(false);
    expect(store.cloudConflict).not.toBe(null);
    store.resolveCloudConflict(true);
    expect(store.cloudConflict).toBe(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(monthOp(allOps(), '2026-10').data.tasks).toEqual([]);
  });

  it('ошибка чтения облака при входе повторяется', async () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    store.user = { uid: 'u1' };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getDoc).mockRejectedValueOnce({ code: 'internal' });
    vi.mocked(getDocs).mockResolvedValue({ forEach: () => {} });

    await store.connectCloud();
    expect(store.syncState).toBe('error');
    expect(store.isAuthReady).toBe(false);

    vi.mocked(getDoc).mockResolvedValue({ exists: () => false });
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.isAuthReady).toBe(true);
    expect(store.syncState).toBe('synced');
  });

  it('настройки с другого устройства применяются, если здесь их не меняли', async () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    store.user = { uid: 'u1' };
    setCloud({ root: { schemaVersion: 2, settings: { theme: 'light' } } });
    await store.connectCloud();

    const rootSnap = settings => ({
      exists: () => true,
      data: () => ({ schemaVersion: 2, settings, deviceId: 'other' }),
      metadata: { hasPendingWrites: false, fromCache: false },
    });
    store.handleRootSnapshot(rootSnap({ theme: 'dark', calculationMode: 'passedDays' }));
    expect(store.theme).toBe('dark');
    expect(store.calculationMode).toBe('passedDays');

    store.setTheme('light');
    store.handleRootSnapshot(rootSnap({ theme: 'system' }));
    expect(store.theme).toBe('light');
  });
});

describe('выход из аккаунта', () => {
  it('очищает данные только после подтверждённой записи в облако', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    signIn(store);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fs.commit.mockRejectedValueOnce({ code: 'permission-denied' });
    store.cycleMark(1, 2, 0);

    expect(await store.logout()).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
    expect(store.tasks).toHaveLength(1);

    expect(await store.logout()).toBe(true);
    expect(signOut).toHaveBeenCalled();
    expect(store.tasks).toEqual([]);
    expect(store.canUndo).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(localStorage.getItem('habitArchive')).toBe(null);
    expect(localStorage.getItem('habitSyncMeta')).toBe(null);
  });

  it('без сети и без несохранённых правок выход не блокируется', async () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    signIn(store);
    store.markOffline();
    expect(store.syncState).toBe('offline');
    expect(await store.logout()).toBe(true);
  });

  it('с force выходит без записи; без прочитанного облака локальные данные не теряются молча', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    store.user = { uid: 'u1' };
    expect(await store.logout()).toBe(false);
    expect(await store.logout({ force: true })).toBe(true);
    expect(fs.commit).not.toHaveBeenCalled();
  });

  it('нерешённый конфликт блокирует выход: версия устройства есть только здесь', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [task(Array(31).fill(true))] },
    });
    store.user = { uid: 'u1' };
    setCloud({
      root: { schemaVersion: 2 },
      months: { '2026-10': { tasks: [task(Array(31).fill(false), 5)], revision: 1 } },
    });
    await store.connectCloud();
    expect(await store.logout()).toBe(false);
  });
});
