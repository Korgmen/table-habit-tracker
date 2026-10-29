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
 * Серия к дню dayIndex включительно: { count, unit: 'day' | 'week' }.
 * - Обычная привычка и расписание: дни подряд, когда выполнены все подзадачи; пропуск
 *   (в том числе день вне расписания) серию не прерывает и не увеличивает.
 * - Цель «N раз в неделю»: недели подряд, когда цель выполнена у всех подзадач (выполнено ≥ цели
 *   недели с округлением вверх). Неделя с dayIndex ещё идёт: если цель пока не набрана, она серию
 *   не прерывает, а только не засчитывается.
 */
export const taskStreak = (task, ctx, dayIndex) => {
  if (task.goal) {
    let count = 0;
    const weeks = monthWeeks(ctx).filter(([start]) => start <= dayIndex);
    for (let w = weeks.length - 1; w >= 0; w--) {
      const [start, end] = weeks[w];
      const last = Math.min(end, dayIndex + 1);
      const met = task.subtasks.every(subtask => {
        const { done, target } = weekGoal(subtask.marks, task.goal, start, last);
        return done >= Math.ceil(target - 1e-9);
      });
      if (met) count++;
      else if (w !== weeks.length - 1) break;
    }
    return { count, unit: 'week' };
  }

  let count = 0;
  for (let i = dayIndex; i >= 0; i--) {
    const marks = task.subtasks.map(subtask => subtask.marks[i]);
    if (marks.every(mark => mark === true)) count++;
    else if (marks.every(mark => mark === false)) continue;
    else break;
  }
  return { count, unit: 'day' };
};

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
