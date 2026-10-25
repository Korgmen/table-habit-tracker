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

/** Проверяет форму архива: ключи YYYY-MM, у задач строковый title и subtasks, marks из true/false/null */
export const isValidArchive = archive =>
  archive !== null &&
  typeof archive === 'object' &&
  !Array.isArray(archive) &&
  Object.entries(archive).every(
    ([key, month]) =>
      /^\d{4}-(0[1-9]|1[0-2])$/.test(key) &&
      Array.isArray(month?.tasks) &&
      month.tasks.every(
        task =>
          typeof task?.title === 'string' &&
          Array.isArray(task.subtasks) &&
          task.subtasks.every(
            subtask =>
              subtask &&
              (subtask.marks === undefined ||
                (Array.isArray(subtask.marks) && subtask.marks.every(isValidMark)))
          )
      )
  );
