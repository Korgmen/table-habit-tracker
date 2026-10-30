/**
 * Расчёты по отметкам привычки за месяц: учитываемые дни, процент выполнения и серии.
 * Контекст месяца ctx = { year, month, days, maxDay, firstWeekday }:
 * month 0–11, days – дней в месяце, maxDay – сколько первых дней учитывается
 * (весь месяц или прошедшие дни), firstWeekday – день начала недели (0 – воскресенье).
 */

/** День недели (0 – воскресенье) для индекса дня месяца */
export const weekdayAt = (ctx, dayIndex) => new Date(ctx.year, ctx.month, dayIndex + 1).getDay();

/** В этот день недели привычка ожидается по расписанию; без расписания (null) – каждый день */
const isDueOn = (schedule, weekday) => !schedule || schedule.includes(weekday);

/**
 * Расписание по дням недели ставит пропуск (false) во все пустые дни вне расписания, включая
 * будущие, – так же, как пропуск вручную. Выполненные дни не трогаются.
 * При смене расписания previous – прежнее: пропуски в дни, которые стали днями расписания,
 * снимаются (ручной пропуск в такой день от расписанного не отличить, он тоже снимается).
 * @returns {boolean} true, если отметки изменились
 */
export const applySchedule = (task, ctx, previous = task.schedule ?? null) => {
  let changed = false;
  task.subtasks.forEach(subtask => {
    for (let i = 0; i < ctx.days; i++) {
      const weekday = weekdayAt(ctx, i);
      const due = isDueOn(task.schedule, weekday);
      const mark = subtask.marks[i] ?? null;
      if (!due && mark === null) {
        subtask.marks[i] = false;
        changed = true;
      } else if (due && !isDueOn(previous, weekday) && mark === false) {
        subtask.marks[i] = null;
        changed = true;
      }
    }
  });
  return changed;
};

/** Недели месяца как отрезки индексов дней [start, end), первая и последняя могут быть неполными */
export const monthWeeks = ctx => {
  const weeks = [];
  let start = 0;
  for (let i = 1; i <= ctx.days; i++) {
    if (i === ctx.days || weekdayAt(ctx, i) === ctx.firstWeekday) {
      weeks.push([start, i]);
      start = i;
    }
  }
  return weeks;
};

/**
 * Цель «N раз в неделю» для отрезка дней [start, end) подзадачи: { done, target }.
 * Пропуск (false) убирает день из недели, поэтому цель пропорциональна учитываемым дням:
 * target = N × (дней недели в отрезке без пропусков) / 7. Полная неделя без пропусков даёт ровно N,
 * неполная неделя на краю месяца или ещё идущая неделя (режим прошедших дней) – долю N.
 */
const weekGoal = (marks, goal, start, end) => {
  let done = 0;
  let counted = 0;
  for (let i = start; i < end; i++) {
    if (marks[i] === true) done++;
    if (marks[i] !== false) counted++;
  }
  return { done, target: (goal * counted) / 7 };
};

/**
 * Цель недели набрана: выполнено не меньше цели недели с округлением вверх. Цель неполной недели
 * на краю месяца пропорциональна её длине: N × (дней недели в месяце) / 7.
 */
const weekGoalMet = (marks, goal, start, end) => {
  const done = marks.slice(start, end).filter(mark => mark === true).length;
  return done >= Math.ceil((goal * (end - start)) / 7 - 1e-9);
};

/** Набранные недели цели по подзадачам: [[bool по неделям], …]; без цели – все false */
export const goalWeeks = (task, ctx) =>
  task.subtasks.map(subtask =>
    monthWeeks(ctx).map(
      ([start, end]) => !!task.goal && weekGoalMet(subtask.marks, task.goal, start, end)
    )
  );

/**
 * Цель «N раз в неделю»: неделя, в которой цель только что набрана, закрывает свои пустые дни
 * пропуском (false). Неделя, которая перестала быть набранной (сняли отметку, сменили цель),
 * снимает пропуски – ручной пропуск в ней от поставленного целью не отличить, он тоже снимается.
 * Срабатывает только на переходе, поэтому снятый вручную пропуск в набранной неделе остаётся снятым.
 * @param {Array} before - goalWeeks до изменения
 */
export const applyGoal = (task, ctx, before) => {
  const weeks = monthWeeks(ctx);
  const after = goalWeeks(task, ctx);
  task.subtasks.forEach((subtask, s) =>
    weeks.forEach(([start, end], w) => {
      const was = !!before[s]?.[w];
      if (after[s][w] === was) return;
      for (let i = start; i < end; i++) {
        if (after[s][w] && (subtask.marks[i] ?? null) === null) subtask.marks[i] = false;
        else if (!after[s][w] && subtask.marks[i] === false) subtask.marks[i] = null;
      }
    })
  );
};

/**
 * Процент выполнения задачи за учитываемые дни месяца; null, если учитывать нечего.
 * - Обычная привычка и расписание: выполнено / (выполнено + не выполнено). Пропуск не учитывается,
 *   дни вне расписания – это пропуски (applySchedule).
 * - Цель «N раз в неделю»: по каждой неделе засчитывается min(выполнено, цель недели) (weekGoal),
 *   процент = сумма засчитанного / сумма целей. Лишние выполнения сверх цели в недели не переносятся.
 */
export const taskProgress = (task, ctx) => {
  if (!task.subtasks?.length) return null;
  let credit = 0;
  let total = 0;

  if (task.goal) {
    const weeks = monthWeeks(ctx)
      .map(([start, end]) => [start, Math.min(end, ctx.maxDay)])
      .filter(([start, end]) => start < end);
    task.subtasks.forEach(subtask =>
      weeks.forEach(([start, end]) => {
        const { done, target } = weekGoal(subtask.marks, task.goal, start, end);
        credit += Math.min(done, target);
        total += target;
      })
    );
  } else {
    task.subtasks.forEach(subtask => {
      for (let i = 0; i < ctx.maxDay; i++) {
        const mark = subtask.marks[i];
        if (mark === true) credit++;
        if (mark !== false) total++;
      }
    });
  }
  return total > 0 ? (credit / total) * 100 : null;
};

/**
 * Итоги месяца для серий по порядку до дня lastIndex включительно: дни, а для цели «N раз в неделю» –
 * недели. 'done' засчитывается, 'miss' прерывает серию, 'skip' и 'open' не делают ни того, ни другого.
 * - День: 'done', если выполнены все подзадачи, кроме пропущенных; 'skip', если пропущены все
 *   (в том числе день вне расписания); иначе 'miss'.
 * - Неделя цели: 'done', если цель недели набрана у всех подзадач (выполнено ≥ цели с округлением
 *   вверх); 'skip', если вся неделя в пропусках. Неделя с lastIndex ещё идёт, если lastIndex не её
 *   последний день: не набранная пока цель даёт 'open'.
 * @param {boolean} open - lastIndex – сегодня: невыполненный день ещё может стать выполненным ('open')
 */
export const streakUnits = (task, ctx, lastIndex, open = false) => {
  if (task.goal) {
    return monthWeeks(ctx)
      .filter(([start]) => start <= lastIndex)
      .map(([start, end]) => {
        const last = Math.min(end, lastIndex + 1);
        const goals = task.subtasks.map(subtask => weekGoal(subtask.marks, task.goal, start, last));
        if (goals.every(({ target }) => target < 1e-9)) return 'skip';
        if (goals.every(({ done, target }) => done >= Math.ceil(target - 1e-9))) return 'done';
        return last < end || open ? 'open' : 'miss';
      });
  }

  const units = [];
  for (let i = 0; i <= lastIndex && i < ctx.days; i++) {
    const marks = task.subtasks.map(subtask => subtask.marks[i] ?? null);
    if (marks.every(mark => mark === false)) units.push('skip');
    else if (marks.every(mark => mark !== null)) units.push('done');
    else units.push(open && i === lastIndex ? 'open' : 'miss');
  }
  return units;
};

/** Серии по итогам streakUnits: current – подряд к концу, best – самая длинная */
export const streakRuns = units => {
  let current = 0;
  let best = 0;
  units.forEach(unit => {
    if (unit === 'done') best = Math.max(best, ++current);
    else if (unit === 'miss') current = 0;
  });
  return { current, best };
};

/**
 * Серия к дню dayIndex включительно в пределах месяца: { count, unit: 'day' | 'week' }.
 * Правила дней и недель – streakUnits; серии через месяцы считает src/utils/stats.js.
 */
export const taskStreak = (task, ctx, dayIndex, open = false) => ({
  count: streakRuns(streakUnits(task, ctx, dayIndex, open)).current,
  unit: task.goal ? 'week' : 'day',
});

/**
 * Учитываемые и выполненные отметки за день по всем активным привычкам: { done, total }.
 * Привычки на паузе и пропуски не учитываются.
 */
export const dayTotals = (tasks, dayIndex) => {
  let done = 0;
  let total = 0;
  tasks.forEach(task => {
    if (task.paused) return;
    task.subtasks.forEach(subtask => {
      const mark = subtask.marks[dayIndex];
      if (mark === true) done++;
      if (mark !== false) total++;
    });
  });
  return { done, total };
};
