/**
 * Статистика по всему архиву: серии через месяцы, средние по месяцам, тепловая карта, сводка года
 * и поиск. Расчёты по отметкам месяца – src/utils/habitMath.js.
 * opts = { today: Date, weekStart: 'monday' | 'sunday', calculationMode: 'fullMonth' | 'passedDays' }
 */
import { monthKey, filledMonths } from '@/utils/archive';
import { streakUnits, streakRuns, taskProgress, dayTotals } from '@/utils/habitMath';

/**
 * Привычка в разных месяцах: при переносе в новый месяц id меняется, поэтому одна и та же
 * привычка узнаётся по названию без учёта регистра и пробелов по краям.
 */
export const habitKey = title => title.trim().toLocaleLowerCase();

/** Ключ месяца со сдвигом на delta месяцев */
export const shiftMonth = (key, delta) => {
  const [year, month] = key.split('-').map(Number);
  return monthKey(new Date(year, month - 1 + delta, 1));
};

/**
 * Контекст месяца key для habitMath (как store.monthCtx) и passed – сколько первых дней наступило:
 * у прошедших месяцев все, у текущего – по сегодня включительно.
 */
export const monthCtxFor = (key, { today, weekStart, calculationMode }) => {
  const [year, month] = key.split('-').map(Number);
  const days = new Date(year, month, 0).getDate();
  const passed = key === monthKey(today) ? today.getDate() : days;
  return {
    year,
    month: month - 1,
    days,
    maxDay: calculationMode === 'passedDays' ? passed : days,
    firstWeekday: weekStart === 'monday' ? 1 : 0,
    passed,
  };
};

/** Задача привычки hk в месяце key; null, если её там нет */
const findHabit = (archive, key, hk) =>
  archive[key]?.tasks?.find(task => habitKey(task.title) === hk) ?? null;

/**
 * Итоги серии привычки hk в месяце key до дня lastIndex (по умолчанию – последний наступивший);
 * null, если привычки в месяце нет. Сегодня ещё идёт: невыполненный день серию не прерывает.
 */
const monthUnits = (archive, key, hk, opts, lastIndex = null) => {
  const task = findHabit(archive, key, hk);
  if (!task) return null;
  const ctx = monthCtxFor(key, opts);
  const last = Math.min(lastIndex ?? ctx.passed - 1, ctx.passed - 1);
  const open = key === monthKey(opts.today) && last === ctx.passed - 1;
  return { task, units: streakUnits(task, ctx, last, open) };
};

/**
 * Текущая серия привычки к дню dayIndex месяца key (по умолчанию – к сегодня): { count, unit }.
 * Серия продолжается в прошлые месяцы, пока в них есть привычка с тем же названием; месяц без неё
 * прерывает серию. unit – 'week' для цели «N раз в неделю» (по месяцу key), иначе 'day'.
 * Недели цели режутся границей месяца: неполные недели по краям считаются отдельно.
 */
export const currentStreak = (
  archive,
  title,
  opts,
  key = monthKey(opts.today),
  dayIndex = null
) => {
  const hk = habitKey(title);
  let count = 0;
  let unit = null;
  for (let month = key; ; month = shiftMonth(month, -1)) {
    const found = monthUnits(archive, month, hk, opts, month === key ? dayIndex : null);
    if (!found) break;
    unit ??= found.task.goal ? 'week' : 'day';
    for (let i = found.units.length - 1; i >= 0; i--) {
      if (found.units[i] === 'done') count++;
      else if (found.units[i] === 'miss') return { count, unit };
    }
  }
  return { count, unit: unit ?? 'day' };
};

/** Месяцы архива с привычками не позже сегодняшнего, по возрастанию */
const pastMonths = (archive, opts) => {
  const last = monthKey(opts.today);
  return filledMonths(archive).filter(key => key <= last);
};

/**
 * Лучшая серия привычки за все месяцы keys (по умолчанию – весь архив): { count, unit }.
 * Пропущенный месяц или месяц без привычки прерывает серию.
 */
export const bestStreak = (archive, title, opts, keys = pastMonths(archive, opts)) => {
  const hk = habitKey(title);
  let units = [];
  let unit = 'day';
  let previous = null;
  keys.forEach(key => {
    const found = monthUnits(archive, key, hk, opts);
    if (!found) return;
    if (previous && shiftMonth(previous, 1) !== key) units.push('miss');
    units = units.concat(found.units);
    unit = found.task.goal ? 'week' : 'day';
    previous = key;
  });
  return { count: streakRuns(units).best, unit };
};

/** Все привычки архива по ключу habitKey: последние название, эмодзи и цвет */
export const archiveHabits = (archive, keys = filledMonths(archive)) => {
  const habits = new Map();
  keys.forEach(key =>
    archive[key].tasks.forEach(task => {
      const hk = habitKey(task.title);
      const habit = habits.get(hk) ?? { key: hk, months: [] };
      Object.assign(habit, { title: task.title, emoji: task.emoji, color: task.color });
      habit.months.push(key);
      habits.set(hk, habit);
    })
  );
  return [...habits.values()];
};

/** Процент привычки по месяцам, где она есть, по возрастанию: [{ key, value }] */
export const habitMonths = (archive, title, opts) => {
  const hk = habitKey(title);
  return pastMonths(archive, opts)
    .map(key => ({ key, task: findHabit(archive, key, hk) }))
    .filter(({ task }) => task)
    .map(({ key, task }) => ({ key, value: taskProgress(task, monthCtxFor(key, opts)) ?? 0 }));
};

/** Лучшая серия среди всех привычек: { title, emoji, count, unit }; null без серий */
export const bestOverall = (archive, opts) => {
  const keys = pastMonths(archive, opts);
  let best = null;
  archiveHabits(archive, keys).forEach(habit => {
    const streak = bestStreak(archive, habit.title, opts, keys);
    if (streak.count > 0 && (!best || streak.count > best.count)) {
      best = { title: habit.title, emoji: habit.emoji, ...streak };
    }
  });
  return best;
};

/**
 * Средний процент месяца по привычкам не на паузе, как общий процент в шапке: привычка,
 * где учитывать нечего, даёт 0. null, если активных привычек нет.
 */
export const monthAverage = (tasks, ctx) => {
  const active = (tasks || []).filter(task => !task.paused);
  if (active.length === 0) return null;
  const sum = active.reduce((total, task) => total + (taskProgress(task, ctx) ?? 0), 0);
  return sum / active.length;
};

/** Средние проценты месяцев keys: [{ key, avg: число | null }] */
export const monthAverages = (archive, keys, opts) =>
  keys.map(key => ({
    key,
    avg: archive[key]?.tasks?.length
      ? monthAverage(archive[key].tasks, monthCtxFor(key, opts))
      : null,
  }));

/** Доля выполненного за день по активным привычкам: 0–1, null если учитывать нечего */
export const dayRatio = (tasks, dayIndex) => {
  const { done, total } = dayTotals(tasks || [], dayIndex);
  return total > 0 ? done / total : null;
};

/**
 * Дни месяца key для тепловой карты: [{ day, ratio, done, total, future }];
 * у будущих дней ratio null.
 */
export const monthHeat = (archive, key, opts) => {
  const ctx = monthCtxFor(key, opts);
  const tasks = archive[key]?.tasks || [];
  return Array.from({ length: ctx.days }, (_, index) => {
    const future = index >= ctx.passed;
    const { done, total } = future ? { done: 0, total: 0 } : dayTotals(tasks, index);
    return { day: index + 1, ratio: total > 0 ? done / total : null, done, total, future };
  });
};

/** Тепловая карта года: дни по месяцам [{ key, days: monthHeat }], будущие месяцы пустые */
export const yearHeat = (archive, year, opts) =>
  Array.from({ length: 12 }, (_, month) => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (key > monthKey(opts.today)) {
      const days = new Date(year, month + 1, 0).getDate();
      return {
        key,
        days: Array.from({ length: days }, (_, index) => ({
          day: index + 1,
          ratio: null,
          done: 0,
          total: 0,
          future: true,
        })),
      };
    }
    return { key, days: monthHeat(archive, key, opts) };
  });

/** Годы, в которых есть привычки, по возрастанию; текущий год есть всегда */
export const archiveYears = (archive, opts) => {
  const years = new Set(pastMonths(archive, opts).map(key => Number(key.slice(0, 4))));
  years.add(opts.today.getFullYear());
  return [...years].sort((a, b) => a - b);
};

/**
 * Сводка года по привычкам: [{ key, title, emoji, color, months, done, avg, best }]:
 * months – месяцев с привычкой, done – выполненных отметок, avg – средний процент по этим
 * месяцам, best – лучшая серия внутри года. По убыванию среднего процента.
 */
export const yearHabits = (archive, year, opts) => {
  const keys = pastMonths(archive, opts).filter(key => key.startsWith(`${year}-`));
  return archiveHabits(archive, keys)
    .map(habit => {
      let done = 0;
      let sum = 0;
      habit.months.forEach(key => {
        const task = findHabit(archive, key, habit.key);
        const ctx = monthCtxFor(key, opts);
        sum += taskProgress(task, ctx) ?? 0;
        task.subtasks.forEach(subtask => {
          for (let i = 0; i < ctx.passed; i++) if (subtask.marks[i] === true) done++;
        });
      });
      return {
        ...habit,
        months: habit.months.length,
        done,
        avg: sum / habit.months.length,
        best: bestStreak(archive, habit.title, opts, keys),
      };
    })
    .sort((a, b) => b.avg - a.avg);
};

/** Строка для поиска: без регистра и пробелов по краям */
export const searchText = text => (text || '').trim().toLocaleLowerCase();

/** Привычка подходит под запрос q (searchText): название, эмодзи или заметки месяца */
export const taskMatches = (task, q) =>
  !q ||
  searchText(task.title).includes(q) ||
  (!!task.emoji && task.emoji.includes(q)) ||
  Object.values(task.notes || {}).some(text => searchText(text).includes(q));

/** Сколько заметок показывать в результатах поиска по архиву */
const NOTE_RESULTS = 100;

/**
 * Поиск по архиву: { habits, notes }.
 * habits – привычки, у которых название или эмодзи содержит запрос: archiveHabits с месяцами,
 * новые месяцы первыми; notes – заметки с запросом [{ key, day, taskId, title, emoji, text }],
 * новые первыми.
 */
export const searchArchive = (archive, query) => {
  const q = searchText(query);
  if (!q) return { habits: [], notes: [] };
  const keys = filledMonths(archive);
  const habits = archiveHabits(archive, keys)
    .filter(habit => habit.key.includes(q) || (!!habit.emoji && habit.emoji.includes(q)))
    .map(habit => ({ ...habit, months: [...habit.months].reverse() }));
  const notes = [];
  [...keys].reverse().forEach(key =>
    archive[key].tasks.forEach(task =>
      Object.entries(task.notes || {}).forEach(([index, text]) => {
        if (searchText(text).includes(q)) {
          notes.push({
            key,
            day: Number(index) + 1,
            taskId: task.id,
            title: task.title,
            emoji: task.emoji,
            text,
          });
        }
      })
    )
  );
  notes.sort((a, b) => (a.key === b.key ? b.day - a.day : a.key < b.key ? 1 : -1));
  return { habits, notes: notes.slice(0, NOTE_RESULTS) };
};
