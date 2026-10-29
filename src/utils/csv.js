/**
 * Таблица CSV для электронных таблиц, широкий вид: строка на подзадачу привычки в месяце,
 * колонки дней 1–31. Значения: 1 – выполнено, 0 – не выполнено, x – пропуск,
 * пусто – день ещё не наступил или его нет в месяце.
 */

/** Значение начинается как формула: электронная таблица выполнила бы его, поэтому экранируется */
const FORMULA_START = /^[=+\-@\t\r]/;

const cell = value => {
  let text = String(value ?? '');
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n;]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
};

const markValue = mark => (mark === true ? '1' : mark === false ? 'x' : '0');

/**
 * @param {Object} archive - архив { 'YYYY-MM': { tasks } }
 * @param {string[]} keys - месяцы по порядку
 * @param {Object} options - labels: { month, habit, mark, progress, notes } – заголовки колонок;
 *   realMonth и realDay – сегодняшние месяц и число: более поздние дни остаются пустыми
 * @returns {string} CSV с BOM (Excel распознаёт UTF-8) и переводами строк CRLF
 */
export const archiveToCsv = (archive, keys, { labels, realMonth, realDay }) => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const rows = [[labels.month, labels.habit, labels.mark, ...days, labels.progress, labels.notes]];

  keys.forEach(key => {
    const [year, month] = key.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const lastDay = key === realMonth ? realDay : daysInMonth;

    (archive[key]?.tasks || []).forEach(task => {
      const habit = task.emoji ? `${task.emoji} ${task.title}` : task.title;
      const notes = Object.entries(task.notes || {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([day, text]) => `${Number(day) + 1}: ${text}`)
        .join(' | ');
      task.subtasks.forEach((subtask, index) => {
        rows.push([
          key,
          habit,
          index + 1,
          ...days.map(day => (day <= lastDay ? markValue(subtask.marks?.[day - 1] ?? null) : '')),
          String(task.progress ?? 0),
          index === 0 ? notes : '',
        ]);
      });
    });
  });

  return `\uFEFF${rows.map(row => row.map(cell).join(',')).join('\r\n')}\r\n`;
};
