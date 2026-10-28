/** Лимиты задач в месяце, подзадач в задаче, длины названия и дней в месяце */
export const MAX_TASKS = 20;
export const MAX_SUBTASKS = 8;
export const MAX_TITLE = 60;
const MAX_DAYS = 31;

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

/** Архив без пустых месяцев с отсортированными ключами, для сравнения локальных и облачных данных */
export const normalizeArchive = archive => {
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
  const filled = Object.fromEntries(
    Object.entries(archive).filter(([, month]) => month?.tasks?.length > 0)
  );
  return JSON.stringify(sortKeys(filled));
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

/**
 * Даёт новые id задачам без id или с повтором в месяце и так же подзадачам внутри задачи,
 * нечитаемый progress сбрасывает в 0 (пересчитывается при открытии месяца).
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
 * 2: { schemaVersion, exportedAt, settings, archive }; файлы без schemaVersion – версия 1, голый архив.
 */
export const SCHEMA_VERSION = 2;

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
export const exportFileName = (date, prefix = 'habit_data') =>
  `${prefix}_${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}.json`;
