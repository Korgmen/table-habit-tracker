import { describe, it, expect } from 'vitest';
import {
  monthWeeks,
  taskProgress,
  taskStreak,
  dayTotals,
  applySchedule,
  goalWeeks,
  applyGoal,
} from '@/utils/habitMath';

/** Октябрь 2026: 1-е – четверг, неделя с понедельника */
const ctx = (maxDay = 31) => ({ year: 2026, month: 9, days: 31, maxDay, firstWeekday: 1 });

const marksWith = values => {
  const marks = Array(31).fill(null);
  Object.entries(values).forEach(([index, mark]) => (marks[index] = mark));
  return marks;
};

const habit = (marks, fields = {}) => ({
  id: 1,
  title: 'T',
  subtasks: [{ id: 2, marks }],
  ...fields,
});

describe('monthWeeks', () => {
  it('режет месяц на недели с выбранного дня, края неполные', () => {
    expect(monthWeeks(ctx())).toEqual([
      [0, 4],
      [4, 11],
      [11, 18],
      [18, 25],
      [25, 31],
    ]);
    expect(monthWeeks({ ...ctx(), firstWeekday: 0 })[0]).toEqual([0, 3]);
  });
});

describe('taskProgress', () => {
  it('без расписания: пропуск не учитывается', () => {
    const task = habit(marksWith({ 0: true, 1: false, 2: null }));
    expect(taskProgress(task, ctx(3))).toBe(50);
  });

  it('цель N раз в неделю: цель недели пропорциональна учитываемым дням, сверх цели не засчитывается', () => {
    /** Неделя 1–4 октября (4 дня): цель 3×4/7, выполнено 2 – засчитана вся цель.
     *  Неделя 5–11 с одним пропуском: цель 3×6/7, выполнено 1. */
    const task = habit(marksWith({ 0: true, 1: true, 4: true, 5: false }), { goal: 3 });
    expect(taskProgress(task, ctx(11))).toBeCloseTo((19 / 30) * 100, 6);
  });

  it('нет учитываемых дней – null', () => {
    expect(taskProgress(habit(marksWith({ 0: false })), ctx(1))).toBe(null);
    expect(taskProgress({ id: 1, title: 'T', subtasks: [] }, ctx())).toBe(null);
  });
});

describe('applySchedule', () => {
  it('ставит пропуск в пустые дни вне расписания, выполненные не трогает', () => {
    /** пн, ср, пт; 1 октября – четверг */
    const task = habit(marksWith({ 0: true }), { schedule: [1, 3, 5] });
    expect(applySchedule(task, ctx())).toBe(true);
    const marks = task.subtasks[0].marks;
    expect(marks.slice(0, 7)).toEqual([true, null, false, false, null, false, null]);
    expect(marks[30]).toBe(false);
    expect(taskProgress(task, ctx(7))).toBe(25);
    expect(applySchedule(task, ctx())).toBe(false);
  });

  it('при смене расписания снимает пропуски с дней, ставших днями расписания', () => {
    const task = habit(marksWith({}), { schedule: [1] });
    applySchedule(task, ctx());
    task.subtasks[0].marks[1] = true;
    task.schedule = [1, 5];
    applySchedule(task, ctx(), [1]);
    /** пт 2 – выполнено, пт 9 – снова пусто, сб 3 – по-прежнему пропуск */
    expect(task.subtasks[0].marks.slice(1, 3)).toEqual([true, false]);
    expect(task.subtasks[0].marks[8]).toBe(null);

    delete task.schedule;
    applySchedule(task, ctx(), [1, 5]);
    expect(task.subtasks[0].marks.every(mark => mark !== false)).toBe(true);
  });
});

describe('applyGoal', () => {
  it('закрывает неделю при наборе цели, неполная неделя – с пропорциональной целью', () => {
    /** Неделя 1–4 октября (4 дня): цель 3 → ceil(3×4/7) = 2 */
    const task = habit(marksWith({ 0: true }), { goal: 3 });
    const before = goalWeeks(task, ctx());
    task.subtasks[0].marks[2] = true;
    applyGoal(task, ctx(), before);
    expect(task.subtasks[0].marks.slice(0, 5)).toEqual([true, false, true, false, null]);
  });

  it('без перехода ничего не меняет, при потере цели открывает неделю', () => {
    const task = habit(marksWith({ 0: true, 1: false, 2: true, 3: false }), { goal: 3 });
    const met = goalWeeks(task, ctx());
    applyGoal(task, ctx(), met);
    expect(task.subtasks[0].marks[1]).toBe(false);
    task.subtasks[0].marks[2] = null;
    applyGoal(task, ctx(), met);
    expect(task.subtasks[0].marks.slice(0, 4)).toEqual([true, null, null, null]);
  });
});

describe('taskStreak', () => {
  it('дни подряд: пропуск не прерывает серию', () => {
    /** 2 (пт) выполнено, 3–5 пропуски, 6 (вт) выполнено */
    const task = habit(marksWith({ 1: true, 2: false, 3: false, 4: false, 5: true }));
    expect(taskStreak(task, ctx(), 5)).toEqual({ count: 2, unit: 'day' });
    expect(taskStreak(habit(marksWith({ 1: true, 5: true })), ctx(), 5)).toEqual({
      count: 1,
      unit: 'day',
    });
  });

  it('цель: недели подряд, текущая неделя без набранной цели серию не прерывает', () => {
    const task = habit(marksWith({ 0: true, 4: true, 6: true, 11: true }), { goal: 2 });
    expect(taskStreak(task, ctx(), 12)).toEqual({ count: 2, unit: 'week' });
    expect(taskStreak(task, ctx(), 20)).toEqual({ count: 0, unit: 'week' });
  });
});

describe('dayTotals', () => {
  it('не учитывает паузу и пропуски', () => {
    const tasks = [
      habit(marksWith({ 0: true })),
      habit(marksWith({ 0: null })),
      habit(marksWith({ 0: null }), { paused: true }),
      habit(marksWith({ 0: false })),
    ];
    expect(dayTotals(tasks, 0)).toEqual({ done: 1, total: 2 });
  });
});
