import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
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
  vi.mocked(setDoc).mockReset();
  vi.mocked(setDoc).mockImplementation(() => Promise.resolve());
  vi.mocked(getDoc).mockReset();
  vi.mocked(signOut).mockClear();
});

/** Вошедший пользователь с прочитанным облаком */
const signIn = store => {
  store.user = { uid: 'u1' };
  store.isAuthReady = true;
};

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
    store.duplicateToCurrent();
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

describe('облако', () => {
  it('правки во время записи уходят следующей записью, а не параллельно', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    signIn(store);
    let finish;
    vi.mocked(setDoc).mockImplementationOnce(() => new Promise(resolve => (finish = resolve)));

    store.updateMark(1, 2, 0, true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.syncState).toBe('saving');
    store.updateMark(1, 2, 1, true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(setDoc).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(setDoc).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(setDoc).mock.calls[1][1].archive['2026-10'].tasks[0].subtasks[0].marks[1]
    ).toBe(true);
    expect(store.syncState).toBe('synced');
  });

  it('ошибка записи видна в статусе и повторяется с паузой', async () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    signIn(store);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(setDoc).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'internal' }));

    expect(await store.saveToCloud()).toBe(false);
    expect(store.syncState).toBe('error');
    expect(store.syncError).toBe('internal');

    await vi.advanceTimersByTimeAsync(2000);
    expect(setDoc).toHaveBeenCalledTimes(2);
    expect(store.syncState).toBe('synced');
    expect(store.syncError).toBe(null);
  });

  it('отказ в доступе не повторяется сам', async () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    signIn(store);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(setDoc).mockRejectedValueOnce({ code: 'permission-denied' });
    await store.saveToCloud();
    await vi.advanceTimersByTimeAsync(60000);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(store.syncError).toBe('permission-denied');
  });

  it('слишком большой документ не отправляется', async () => {
    const big = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      title: 'x'.repeat(60),
      progress: 0,
      subtasks: Array.from({ length: 8 }, (_, k) => ({ id: k, marks: Array(31).fill(false) })),
    }));
    const archive = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`${2000 + i}-01`, { tasks: big }])
    );
    const store = createStore(new Date(2026, 9, 10, 12), archive);
    signIn(store);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await store.saveToCloud();
    expect(setDoc).not.toHaveBeenCalled();
    expect(store.syncError).toBe('too-large');
    expect(store.cloudUsage).toBeGreaterThan(1);
  });

  it('ошибка чтения облака при входе повторяется, конфликт ждёт выбора', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    store.user = { uid: 'u1' };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getDoc)
      .mockRejectedValueOnce({ code: 'internal' })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ archive: { '2026-10': { tasks: [task(Array(31).fill(true), 5)] } } }),
      });

    await store.connectCloud();
    expect(store.syncState).toBe('error');
    expect(store.isAuthReady).toBe(false);

    await vi.advanceTimersByTimeAsync(2000);
    expect(store.syncState).toBe('conflict');
    expect(store.cloudConflict).not.toBe(null);

    store.resolveCloudConflict(false);
    expect(store.tasks[0].id).toBe(5);
    expect(store.isAuthReady).toBe(true);
    store.undo();
    expect(store.tasks[0].id).toBe(1);
  });

  it('повреждённый облачный архив нельзя загрузить, только перезаписать', async () => {
    const store = createStore(new Date(2026, 9, 10, 12));
    store.user = { uid: 'u1' };
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ archive: { october: 1 } }),
    });
    await store.connectCloud();
    expect(store.cloudConflict.invalid).toBe(true);
    store.resolveCloudConflict(false);
    expect(store.cloudConflict).not.toBe(null);
    store.resolveCloudConflict(true);
    expect(store.isAuthReady).toBe(true);
  });
});

describe('выход из аккаунта', () => {
  it('очищает данные только после подтверждённой записи в облако', async () => {
    const store = createStore(new Date(2026, 9, 10, 12), {
      '2026-10': { tasks: [task(Array(31).fill(null))] },
    });
    signIn(store);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(setDoc).mockRejectedValueOnce({ code: 'permission-denied' });
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
    expect(setDoc).not.toHaveBeenCalled();
  });
});
