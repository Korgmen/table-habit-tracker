import { hashTasks, isValidArchive, prepareArchive } from '@/utils/archive';

/**
 * Синхронизация с Firestore по месяцам: чистые решения без обращений к сети.
 *
 * Облако: users/{uid} – { settings, schemaVersion, updatedAt, deviceId } и
 * users/{uid}/months/{YYYY-MM} – { tasks, revision, base, deviceId, updatedAt, legacyHash, legacyRevision }.
 * revision растёт с каждой записью месяца, base – ревизия, от которой писало устройство.
 *
 * Устройство помнит для каждого месяца, какую версию облака оно видело (метаданные синхронизации):
 * { revision, hash, device } – ревизия, отпечаток задач (hashTasks) и кто её записал.
 * Локальный месяц изменён, если его отпечаток отличается от запомненного; облачный –
 * если отличается ревизия.
 */

/** Версия структуры облака: 2 – месяцы в подколлекции; без поля – старый документ с полем archive */
export const CLOUD_SCHEMA_VERSION = 2;

/** Отпечаток пустого месяца: так выглядит месяц, которого нет в старом архиве */
export const EMPTY_HASH = hashTasks([]);

/** Есть ли в месяце что-то, кроме самих привычек: отметки или заметки */
const hasMarks = tasks =>
  tasks.some(
    task =>
      (task.notes && Object.keys(task.notes).length > 0) ||
      task.subtasks.some(subtask => subtask.marks?.some(mark => mark !== null))
  );

/**
 * Проверяет и подготавливает задачи облачного месяца.
 * @returns {Array|null} задачи или null, если документ повреждён
 */
export const readCloudTasks = (key, tasks) => {
  const archive = { [key]: { tasks } };
  if (!isValidArchive(archive)) return null;
  return prepareArchive(archive)[key].tasks;
};

/**
 * Сверка после входа: что взять из облака, что отправить и где спросить пользователя.
 * @param {Object} local - локальный архив
 * @param {Object} cloud - { [key]: { tasks|null (повреждён), revision, updatedAt, source } }
 * @param {Object} meta - метаданные синхронизации месяцев этого пользователя
 * @returns {{ take: Object, upload: string[], same: Object, conflicts: Object }}
 *   take – { key: облачный месяц } для замены локального, upload – месяцы для записи,
 *   same – { key: облачный месяц } совпавшие, conflicts – { key: облачный месяц } для выбора
 */
export const planConnect = (local, cloud, meta) => {
  const plan = { take: {}, upload: [], same: {}, conflicts: {} };
  const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);

  keys.forEach(key => {
    const localTasks = local[key]?.tasks || [];
    const localHash = hashTasks(localTasks);
    const remote = cloud[key];
    const known = meta[key];

    if (!remote) {
      if (localTasks.length > 0) plan.upload.push(key);
      return;
    }
    if (!remote.tasks) {
      plan.conflicts[key] = remote;
      return;
    }
    if (hashTasks(remote.tasks) === localHash) {
      plan.same[key] = remote;
      return;
    }
    if (remote.forceChoice) {
      plan.conflicts[key] = remote;
      return;
    }

    /** Без метаданных месяц ещё не синхронизировался с этого устройства: изменён, если не пуст.
     *  Исключение – привычки без единой отметки (например, автоперенос): их заменяет облако. */
    const localChanged = known
      ? localHash !== known.hash
      : localTasks.length > 0 && hasMarks(localTasks);
    const remoteChanged = !known || remote.revision !== known.revision;

    if (!localChanged) plan.take[key] = remote;
    else if (!remoteChanged) plan.upload.push(key);
    else plan.conflicts[key] = remote;
  });
  return plan;
};

/**
 * Изменение месяца из подписки, записанное другим устройством.
 * @param {Array} localTasks - задачи месяца на устройстве
 * @param {Object} remote - { tasks|null, revision, base, deviceId }
 * @param {Object|undefined} known - запомненная версия месяца
 * @returns {'same'|'take'|'conflict'|'ignore'}
 *   ignore – уже известная версия; same – менять на устройстве нечего (данные совпали или облако
 *   переписало известную нам версию без изменений), запомнить ревизию; take – взять облачную;
 *   conflict – на устройстве несохранённые правки или облачную версию записали, не видя нашей
 */
export const classifyRemote = (localTasks, remote, known) => {
  if (known && remote.revision === known.revision && remote.deviceId === known.device) {
    return 'ignore';
  }
  if (!remote.tasks) return 'conflict';
  const localHash = hashTasks(localTasks);
  const remoteHash = hashTasks(remote.tasks);
  if (remoteHash === localHash) return 'same';
  /** Другое устройство переписало ту же версию, что знаем мы: правки устройства просто уйдут поверх */
  if (known && remoteHash === known.hash && (remote.base ?? 0) >= known.revision) return 'same';

  const localChanged = known ? localHash !== known.hash : localTasks.length > 0;
  /** Записавшее устройство не видело версию, которая есть у нас: наша версия была бы потеряна */
  const overwrote = !!known && (remote.base ?? 0) < known.revision;
  return localChanged || overwrote ? 'conflict' : 'take';
};

/**
 * Месяцы из старого документа users/{uid} (поле archive), которые нужно влить в подколлекцию.
 * Без месяцев в подколлекции это первая миграция: облако – это старый архив целиком.
 * С месяцами – старую запись сделал клиент, ещё не обновившийся до версии с месяцами: в облако
 * попадают только месяцы, изменённые им после прошлого вливания (отпечаток не совпал с legacyHash).
 * Если месяц менялся и в подколлекции (ревизия ушла от legacyRevision), нужен выбор пользователя.
 * @param {Object} legacy - проверенный и подготовленный старый архив
 * @param {Object} months - { [key]: { tasks|null, revision, legacyHash, legacyRevision, ... } }
 * @returns {{ cloud: Object, absorbed: Object, firstMigration: boolean }}
 *   cloud – облачные месяцы для planConnect, где старая версия заменила документ месяца;
 *   absorbed – { key: отпечаток } влитых месяцев для legacyHash следующих записей
 */
export const mergeLegacy = (legacy, months) => {
  const keys = new Set([...Object.keys(legacy), ...Object.keys(months)]);
  const absorbed = {};
  const firstMigration = Object.keys(months).length === 0;

  if (firstMigration) {
    const cloud = {};
    keys.forEach(key => {
      const tasks = legacy[key]?.tasks || [];
      absorbed[key] = hashTasks(tasks);
      cloud[key] = { tasks, revision: 0, source: 'cloud', unsaved: true };
    });
    return { cloud, absorbed, firstMigration };
  }

  const cloud = { ...months };
  keys.forEach(key => {
    const tasks = legacy[key]?.tasks || [];
    const hash = hashTasks(tasks);
    const month = months[key];
    if (hash === (month?.legacyHash ?? EMPTY_HASH)) return;

    absorbed[key] = hash;
    const changedSince = !!month && month.revision !== (month.legacyRevision ?? 0);
    cloud[key] = {
      tasks,
      /** Ревизия выше облачной: для planConnect облако изменилось с прошлого раза */
      revision: (month?.revision ?? 0) + 1,
      updatedAt: month?.updatedAt,
      source: 'legacy',
      unsaved: true,
      /** Подколлекция тоже менялась: старую версию нельзя взять молча */
      forceChoice: changedSince,
    };
  });
  return { cloud, absorbed, firstMigration };
};
