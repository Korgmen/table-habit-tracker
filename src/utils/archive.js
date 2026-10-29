/** Лимиты задач в месяце, подзадач в задаче, длины названия и дней в месяце */
export const MAX_TASKS = 20;
export const MAX_SUBTASKS = 8;
export const MAX_TITLE = 60;
const MAX_DAYS = 31;

/** Лимит заметки к дню и длины эмодзи (составные эмодзи занимают до ~11 единиц UTF-16) */
export const MAX_NOTE = 500;
const MAX_EMOJI = 16;

/** Цвета привычек: ключи палитры, сами цвета заданы в style.css для светлой и тёмной темы */
export const HABIT_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'pink'];

/** Цель «N раз в неделю»: 7 раз – это каждый день, поэтому цель до 6 */
export const MAX_GOAL = 6;

/** Ключ месяца в архиве: 'YYYY-MM' */
export const monthKey = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const HTML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/**
 * Снимает HTML-экранирование с заголовков задач.
 * В старых экспортах, localStorage и Firestore заголовки лежат экранированными, иногда в несколько слоёв.
 */
export const decodeArchiveTitles = archive => {
  Object.values(archive).forEach(month => {
    if (!Array.isArray(month?.tasks)) return;
    month.tasks.forEach(task => {
      if (typeof task.title !== 'string') return;
      let prev;
      do {
        prev = task.title;
        task.title = prev.replace(/&(amp|lt|gt|quot|#39);/g, entity => HTML_ENTITIES[entity]);
      } while (task.title !== prev);
    });
  });
  return archive;
};

/** Копия значения с отсортированными ключами объектов: одинаковые данные дают одинаковый JSON */
const sortKeys = value => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, sortKeys(value[key])])
    );
  }
  return value;
};

/** Архив без пустых месяцев с отсортированными ключами, для сравнения локальных и облачных данных */
export const normalizeArchive = archive => {
  const filled = Object.fromEntries(
    Object.entries(archive).filter(([, month]) => month?.tasks?.length > 0)
  );
  return JSON.stringify(sortKeys(filled));
};

/** 32-битный хеш FNV-1a строки */
const fnv1a = text => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/**
 * Отпечаток задач месяца для синхронизации: хеш JSON с отсортированными ключами и его длина.
 * progress не входит: он пересчитывается из отметок и меняется сам при смене дня.
 */
export const hashTasks = tasks => {
  const withoutProgress = (tasks || []).map(task => {
    const copy = { ...task };
    delete copy.progress;
    return copy;
  });
  const json = JSON.stringify(sortKeys(withoutProgress));
  return `${fnv1a(json).toString(16)}:${json.length}`;
};

const isValidMark = mark => mark === true || mark === false || mark === null;

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Проверяет форму архива: ключи YYYY-MM, лимиты задач и подзадач, у задач строковый title
 * и subtasks, marks из true/false/null не длиннее месяца.
 * Длина названия здесь не проверяется: до появления лимита названия могли быть длиннее.
 */
export const isValidArchive = archive =>
  isPlainObject(archive) &&
  Object.entries(archive).every(
    ([key, month]) =>
      /^\d{4}-(0[1-9]|1[0-2])$/.test(key) &&
      Array.isArray(month?.tasks) &&
      month.tasks.length <= MAX_TASKS &&
      month.tasks.every(
        task =>
          isPlainObject(task) &&
          typeof task.title === 'string' &&
          Array.isArray(task.subtasks) &&
          task.subtasks.length <= MAX_SUBTASKS &&
          task.subtasks.every(
            subtask =>
              isPlainObject(subtask) &&
              (subtask.marks === undefined ||
                (Array.isArray(subtask.marks) &&
                  subtask.marks.length <= MAX_DAYS &&
                  subtask.marks.every(isValidMark)))
          )
      )
  );

/** Новый id задачи или подзадачи */
export const createId = () => crypto.randomUUID();

const isValidId = id =>
  (typeof id === 'number' && Number.isFinite(id)) || (typeof id === 'string' && id.length > 0);

const isValidProgress = progress =>
  (typeof progress === 'number' && Number.isFinite(progress)) ||
  (typeof progress === 'string' && progress.trim() !== '' && Number.isFinite(Number(progress)));

const isDayKey = key => /^\d{1,2}$/.test(key) && Number(key) < MAX_DAYS;

/**
 * Необязательные поля задачи: недопустимые значения убираются, архив остаётся валидным –
 * испорченный цвет или заметка не блокируют загрузку остальных данных.
 * - color: ключ из HABIT_COLORS; emoji: короткая строка
 * - schedule: дни недели (0 – воскресенье), когда привычка ожидается; нет поля – каждый день
 * - goal: «N раз в неделю» вместо расписания, 1…MAX_GOAL
 * - paused: привычка на паузе, не входит в общий процент
 * - notes: { [индекс дня]: текст }
 * Поля по умолчанию не хранятся: старые данные и данные без настроек выглядят одинаково.
 */
export const repairTaskFields = task => {
  if (!HABIT_COLORS.includes(task.color)) delete task.color;

  const emoji = typeof task.emoji === 'string' ? task.emoji.trim() : '';
  if (emoji && emoji.length <= MAX_EMOJI) task.emoji = emoji;
  else delete task.emoji;

  const schedule = Array.isArray(task.schedule)
    ? [...new Set(task.schedule)].filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  if (schedule.length > 0 && schedule.length < 7) task.schedule = schedule.sort();
  else delete task.schedule;

  if (Number.isInteger(task.goal) && task.goal >= 1 && task.goal <= MAX_GOAL) delete task.schedule;
  else delete task.goal;

  if (task.paused !== true) delete task.paused;

  const notes = isPlainObject(task.notes)
    ? Object.entries(task.notes).filter(
        ([key, text]) => isDayKey(key) && typeof text === 'string' && text.trim()
      )
    : [];
  if (notes.length > 0) {
    task.notes = Object.fromEntries(
      notes.map(([key, text]) => [String(Number(key)), text.trim().slice(0, MAX_NOTE)])
    );
  } else {
    delete task.notes;
  }
  return task;
};

/**
 * Даёт новые id задачам без id или с повтором в месяце и так же подзадачам внутри задачи,
 * нечитаемый progress сбрасывает в 0 (пересчитывается при открытии месяца),
 * чистит необязательные поля (repairTaskFields).
 * Ожидает архив, прошедший isValidArchive; меняет его на месте.
 */
export const repairArchive = archive => {
  const uniqueIds = items => {
    const seen = new Set();
    items.forEach(item => {
      if (!isValidId(item.id) || seen.has(item.id)) item.id = createId();
      seen.add(item.id);
    });
  };
  Object.values(archive).forEach(month => {
    uniqueIds(month.tasks);
    month.tasks.forEach(task => {
      uniqueIds(task.subtasks);
      if (!isValidProgress(task.progress)) task.progress = 0;
      repairTaskFields(task);
    });
  });
  return archive;
};

/** Приводит проверенный архив к рабочему виду: раскодированные заголовки, уникальные id */
export const prepareArchive = archive => repairArchive(decodeArchiveTitles(archive));

/** Ключи месяцев, где есть задачи, по возрастанию */
export const filledMonths = archive =>
  Object.keys(archive)
    .filter(key => archive[key]?.tasks?.length > 0)
    .sort();

/** Число задач во всех месяцах архива */
export const countTasks = archive =>
  Object.values(archive).reduce((sum, month) => sum + (month?.tasks?.length || 0), 0);

/**
 * Добавляет к архиву current месяцы из incoming. Месяц, заполненный в обоих,
 * берётся из incoming, только если его ключ есть в takeIncoming.
 */
export const mergeArchives = (current, incoming, takeIncoming = []) => {
  const result = { ...current };
  filledMonths(incoming).forEach(key => {
    if (!current[key]?.tasks?.length || takeIncoming.includes(key)) result[key] = incoming[key];
  });
  return result;
};

/**
 * Версия формата файла экспорта.
 * 3: у задач необязательные color, emoji, schedule, goal, paused, notes (repairTaskFields);
 * 2: { schemaVersion, exportedAt, settings, archive }; файлы без schemaVersion – версия 1, голый архив.
 * Старые версии читаются без преобразований: новые поля у них просто отсутствуют.
 */
export const SCHEMA_VERSION = 3;

/** Разбирает содержимое файла экспорта любой версии в { version, archive, settings } */
export const unwrapExport = data => {
  if (isPlainObject(data) && Object.hasOwn(data, 'schemaVersion')) {
    return {
      version: data.schemaVersion,
      archive: data.archive,
      settings: isPlainObject(data.settings) ? data.settings : {},
    };
  }
  return { version: 1, archive: data, settings: {} };
};

/** Имя файла с локальной датой: habit_data_2026-10-26.json */
export const exportFileName = (date, prefix = 'habit_data', ext = 'json') =>
  `${prefix}_${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}.${ext}`;

/** Последний месяц с задачами раньше месяца key; null, если такого нет */
export const lastFilledBefore = (archive, key) =>
  filledMonths(archive)
    .filter(item => item < key)
    .at(-1) ?? null;

/**
 * Копия задач для нового месяца: настройки привычки без отметок и заметок.
 * @param {Function} idFor - (исходный id, номер подзадачи или null для задачи) => новый id
 */
export const carryTasks = (tasks, days, idFor) =>
  tasks.map(task => {
    const { id, title, subtasks, color, emoji, schedule, goal, paused } = task;
    return repairTaskFields({
      id: idFor(id, null),
      title,
      progress: 0,
      subtasks: subtasks.map((subtask, index) => ({
        id: idFor(id, index),
        marks: Array(days).fill(null),
      })),
      color,
      emoji,
      schedule: schedule && [...schedule],
      goal,
      paused,
    });
  });

/**
 * id для автопереноса: один и тот же на всех устройствах, чтобы два устройства,
 * перенёсшие привычки в новый месяц независимо, получили одинаковые данные без конфликта.
 */
export const carryId = (month, sourceId, index) => {
  const part = index ?? '';
  return `c${fnv1a(`${month}|${sourceId}|${part}`).toString(36)}${fnv1a(`${part}|${sourceId}|${month}`).toString(36)}`;
};
