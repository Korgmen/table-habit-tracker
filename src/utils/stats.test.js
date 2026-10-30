import { describe, it, expect } from 'vitest';
import {
  habitKey,
  monthCtxFor,
  currentStreak,
  bestStreak,
  bestOverall,
  habitMonths,
  monthAverage,
  monthAverages,
  monthHeat,
  yearHeat,
  yearHabits,
  archiveYears,
  taskMatches,
  searchArchive,
} from '@/utils/stats';

/** Сегодня 3 октября 2026, неделя с понедельника, проценты за весь месяц */
const opts = {
  today: new Date(2026, 9, 3),
  weekStart: 'monday',
  calculationMode: 'fullMonth',
};

/** Отметки месяца из days дней: done – индексы выполненных, остальное пусто */
const marks = (days, done = [], skips = []) =>
  Array.from({ length: days }, (_, i) =>
    done.includes(i) ? true : skips.includes(i) ? false : null
  );

const range = (from, to) => Array.from({ length: to - from }, (_, i) => from + i);

const task = (title, marksList, fields = {}) => ({
  id: `${title}-${marksList.length}`,
  title,
  progress: 0,
  subtasks: [{ id: 's', marks: marksList }],
  ...fields,
});

describe('monthCtxFor', () => {
  it('прошлый месяц учитывается целиком, текущий – по сегодня', () => {
    expect(monthCtxFor('2026-09', opts)).toMatchObject({ days: 30, passed: 30, maxDay: 30 });
    expect(monthCtxFor('2026-10', opts)).toMatchObject({ days: 31, passed: 3, maxDay: 31 });
    expect(monthCtxFor('2026-10', { ...opts, calculationMode: 'passedDays' }).maxDay).toBe(3);
  });
});

describe('серии через месяцы', () => {
  /** Сентябрь: выполнены 20–30 (11 дней), до этого 1–5; октябрь: 1–2, сегодня ещё не отмечено */
  const archive = {
    '2026-08': { tasks: [task('Бег', marks(31, range(0, 31)))] },
    '2026-09': { tasks: [task(' бег ', marks(30, [...range(0, 5), ...range(19, 30)]))] },
    '2026-10': { tasks: [task('Бег', marks(31, [0, 1]))] },
  };

  it('текущая серия продолжается в прошлый месяц, сегодня без отметки её не обрывает', () => {
    expect(currentStreak(archive, 'Бег', opts)).toEqual({ count: 13, unit: 'day' });
  });

  it('серия к выбранному дню прошлого месяца', () => {
    expect(currentStreak(archive, 'Бег', opts, '2026-09', 4)).toEqual({ count: 36, unit: 'day' });
  });

  it('лучшая серия: август целиком и начало сентября', () => {
    expect(bestStreak(archive, 'бег', opts)).toEqual({ count: 36, unit: 'day' });
    expect(bestOverall(archive, opts)).toMatchObject({ title: 'Бег', count: 36 });
  });

  it('месяц без привычки прерывает серию', () => {
    const gap = { ...archive, '2026-09': { tasks: [task('Другое', marks(30))] } };
    expect(currentStreak(gap, 'Бег', opts).count).toBe(2);
    expect(bestStreak(gap, 'Бег', opts).count).toBe(31);
    const missing = { '2026-08': archive['2026-08'], '2026-10': archive['2026-10'] };
    expect(bestStreak(missing, 'Бег', opts).count).toBe(31);
    expect(currentStreak(missing, 'Бег', opts).count).toBe(2);
  });

  it('цель «N раз в неделю» считается неделями', () => {
    const goal = {
      '2026-10': { tasks: [task('Зал', marks(31, [0, 1]), { goal: 2 })] },
    };
    expect(currentStreak(goal, 'Зал', opts)).toEqual({ count: 1, unit: 'week' });
  });
});

describe('средние и тепловая карта', () => {
  it('средний процент без привычек на паузе, null без активных', () => {
    const ctx = monthCtxFor('2026-09', opts);
    const tasks = [
      task('A', marks(30, range(0, 30))),
      task('B', marks(30, range(0, 15))),
      task('C', marks(30), { paused: true }),
    ];
    expect(monthAverage(tasks, ctx)).toBe(75);
    expect(monthAverage([tasks[2]], ctx)).toBeNull();
  });

  it('средние по месяцам: месяц без привычек даёт null', () => {
    const archive = { '2026-09': { tasks: [task('A', marks(30, range(0, 30)))] } };
    expect(monthAverages(archive, ['2026-08', '2026-09'], opts)).toEqual([
      { key: '2026-08', avg: null },
      { key: '2026-09', avg: 100 },
    ]);
  });

  it('дни месяца: доля выполненного, будущие без данных', () => {
    const archive = {
      '2026-10': { tasks: [task('A', marks(31, [0])), task('B', marks(31, [], [1]))] },
    };
    const days = monthHeat(archive, '2026-10', opts);
    expect(days[0]).toMatchObject({ ratio: 0.5, done: 1, total: 2, future: false });
    expect(days[1]).toMatchObject({ ratio: 0, done: 0, total: 1 });
    expect(days[3]).toMatchObject({ ratio: null, future: true });
    const year = yearHeat(archive, 2026, opts);
    expect(year).toHaveLength(12);
    expect(year[1].days).toHaveLength(28);
    expect(year[11].days.every(day => day.future)).toBe(true);
  });
});

describe('сводка года', () => {
  const archive = {
    '2025-12': { tasks: [task('A', marks(31, range(0, 31)))] },
    '2026-08': { tasks: [task('A', marks(31, range(0, 31))), task('B', marks(31))] },
    '2026-09': { tasks: [task('a', marks(30, range(0, 15)), { emoji: '🏃' })] },
  };

  it('годы с привычками и текущий', () => {
    expect(archiveYears(archive, opts)).toEqual([2025, 2026]);
  });

  it('привычки года по среднему проценту, серия только внутри года', () => {
    const habits = yearHabits(archive, 2026, opts);
    expect(habits.map(habit => [habit.title, habit.months, habit.done, habit.avg])).toEqual([
      ['a', 2, 46, 75],
      ['B', 1, 0, 0],
    ]);
    expect(habits[0]).toMatchObject({ emoji: '🏃', best: { count: 46, unit: 'day' } });
  });

  it('процент привычки по месяцам, где она есть', () => {
    expect(habitMonths(archive, 'A', opts)).toEqual([
      { key: '2025-12', value: 100 },
      { key: '2026-08', value: 100 },
      { key: '2026-09', value: 50 },
    ]);
  });
});

describe('поиск', () => {
  const archive = {
    '2026-08': {
      tasks: [task('Бег', marks(31), { notes: { 4: 'Дождь, бег в зале' } })],
    },
    '2026-09': {
      tasks: [
        task('Бег утром', marks(30), { notes: { 0: 'легко', 9: 'Зал закрыт' } }),
        task('Чтение', marks(30), { emoji: '📚' }),
      ],
    },
  };

  it('ключ привычки без регистра и пробелов по краям', () => {
    expect(habitKey('  Бег ')).toBe(habitKey('бег'));
  });

  it('фильтр месяца: название, эмодзи и заметки', () => {
    const [run, read] = archive['2026-09'].tasks;
    expect(taskMatches(run, 'зал')).toBe(true);
    expect(taskMatches(read, '📚')).toBe(true);
    expect(taskMatches(read, 'зал')).toBe(false);
    expect(taskMatches(read, '')).toBe(true);
  });

  it('привычки с месяцами и заметки, новые первыми', () => {
    const result = searchArchive(archive, ' ЗАЛ');
    expect(result.habits).toEqual([]);
    expect(result.notes.map(note => [note.key, note.day, note.title])).toEqual([
      ['2026-09', 10, 'Бег утром'],
      ['2026-08', 5, 'Бег'],
    ]);
    const habits = searchArchive(archive, 'бег').habits;
    expect(habits.map(habit => [habit.title, habit.months])).toEqual([
      ['Бег', ['2026-08']],
      ['Бег утром', ['2026-09']],
    ]);
    expect(searchArchive(archive, '  ')).toEqual({ habits: [], notes: [] });
  });
});
