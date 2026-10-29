import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, provider, db } from '@/firebase';
import { doc, collection, getDoc, getDocs, writeBatch, onSnapshot } from 'firebase/firestore';
import { resolveLang, applyLang, SUPPORTED_LANGS } from '@/i18n';
import {
  monthKey,
  isValidArchive,
  prepareArchive,
  repairTaskFields,
  createId,
  countTasks,
  mergeArchives,
  unwrapExport,
  exportFileName,
  hashTasks,
  lastFilledBefore,
  carryTasks,
  carryId,
  SCHEMA_VERSION,
  MAX_TASKS,
  MAX_SUBTASKS,
  MAX_TITLE,
  MAX_NOTE,
} from '@/utils/archive';
import { taskProgress, applySchedule, goalWeeks, applyGoal } from '@/utils/habitMath';
import { archiveToCsv } from '@/utils/csv';
import {
  CLOUD_SCHEMA_VERSION,
  planConnect,
  classifyRemote,
  mergeLegacy,
  readCloudTasks,
} from '@/utils/cloudSync';

/** Допустимые значения настроек: облачный документ и файл импорта применяются только по ним */
const SETTINGS_VALUES = {
  theme: ['system', 'light', 'dark'],
  lang: ['system', ...SUPPORTED_LANGS],
  weekStart: ['monday', 'sunday'],
  showWeekSeparators: [true, false],
  calculationMode: ['fullMonth', 'passedDays'],
};

/** Ключи резервной копии архива в localStorage: копия и время её создания */
const BACKUP_KEY = 'habitArchiveBackup';
const BACKUP_AT_KEY = 'habitArchiveBackupAt';

/** Серия кликов подряд пишется в localStorage одной записью */
const LOCAL_SAVE_DELAY = 300;
let localSaveTimer = null;

/** Серия правок подряд (клики по отметкам, переход месяца) уходит в Firestore одной записью */
const CLOUD_SAVE_DELAY = 1000;
let cloudSaveTimer = null;
/** Возможно, есть изменения, которые ещё не записаны в Firestore (какие именно – по отпечаткам) */
let cloudDirty = false;
/** Идущая запись в Firestore: следующая начинается только после неё */
let cloudWrite = null;

/** Лимит документа Firestore 1 МиБ на месяц; размер считается по JSON приблизительно, с запасом */
const CLOUD_DOC_MAX = 1000 * 1000;
/** Документов в одной пакетной записи (лимит Firestore – 500) */
const CLOUD_BATCH_SIZE = 400;

/**
 * Метаданные синхронизации (см. src/utils/cloudSync.js), хранятся в localStorage между запусками:
 * { uid, months: { key: { revision, hash, device } }, settingsHash, legacy: { key: { hash, revision, pending } } }
 */
const SYNC_META_KEY = 'habitSyncMeta';
const emptySyncMeta = uid => ({ uid, months: {}, settingsHash: null, legacy: {} });

/**
 * Идентификатор вкладки: свои записи в подписке пропускаются.
 * Вкладки одного браузера – разные устройства, у каждой свои несохранённые правки.
 */
const DEVICE_ID = createId();

/** Повторы после сбоя синхронизации: паузы растут до минуты */
const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000];
let retryTimer = null;
let retryAttempt = 0;
/** Коды Firestore, при которых сеть недоступна, и коды, после которых имеет смысл повторить */
const OFFLINE_CODES = ['unavailable', 'deadline-exceeded'];
const RETRY_CODES = [...OFFLINE_CODES, 'aborted', 'internal', 'unknown', 'resource-exhausted'];

/** Сколько ждать подтверждения записи в облако перед выходом из аккаунта */
const LOGOUT_SAVE_TIMEOUT = 8000;

/** Номер входа: ответ облака для прошлого пользователя или прошлой попытки отбрасывается */
let authGeneration = 0;

const IMPORT_FILE_LIMIT = 2 * 1024 * 1024;

/** Шагов отмены в памяти */
const HISTORY_LIMIT = 50;
let historyId = 0;

const clone = value => (value == null ? null : JSON.parse(JSON.stringify(value)));

/** Настраиваемые поля задачи, кроме названия и подзадач (см. repairTaskFields) */
const TASK_FIELDS = ['color', 'emoji', 'schedule', 'goal', 'paused'];

/**
 * Поля TASK_FIELDS из source. С keepMissing ключ, явно переданный как undefined,
 * тоже попадает в результат: так правка окна привычки убирает цвет или расписание.
 */
const pickTaskFields = (source, keepMissing = false) =>
  Object.fromEntries(
    TASK_FIELDS.filter(key =>
      keepMissing ? Object.hasOwn(source, key) : source[key] !== undefined
    ).map(key => [key, Array.isArray(source[key]) ? [...source[key]] : source[key]])
  );

const sameTaskFields = (a, b) =>
  TASK_FIELDS.every(key => JSON.stringify(a[key]) === JSON.stringify(b[key]));

/** Отпечаток настроек в фиксированном порядке ключей */
const hashSettings = settings =>
  JSON.stringify(Object.keys(SETTINGS_VALUES).map(key => settings?.[key] ?? null));

const loadSyncMeta = uid => {
  try {
    const saved = JSON.parse(localStorage.getItem(SYNC_META_KEY));
    if (saved?.uid === uid) {
      return {
        ...emptySyncMeta(uid),
        ...saved,
        months: { ...saved.months },
        legacy: { ...saved.legacy },
      };
    }
  } catch (error) {
    console.error(error);
  }
  return emptySyncMeta(uid);
};

const saveSyncMeta = meta => {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch (error) {
    console.error(error);
  }
};

const rootRef = uid => doc(db, 'users', uid);
const monthsRef = uid => collection(db, 'users', uid, 'months');
const monthRef = (uid, key) => doc(db, 'users', uid, 'months', key);

const isMonthKey = key => /^\d{4}-(0[1-9]|1[0-2])$/.test(key);

/** Документ месяца из Firestore: задачи (null, если повреждены) и служебные поля */
const readMonthDoc = (key, data) => ({
  tasks: readCloudTasks(key, data?.tasks),
  revision: Number.isInteger(data?.revision) ? data.revision : 0,
  base: Number.isInteger(data?.base) ? data.base : 0,
  deviceId: data?.deviceId ?? null,
  updatedAt: data?.updatedAt ?? null,
  legacyHash: data?.legacyHash,
  legacyRevision: data?.legacyRevision,
  source: 'cloud',
});

/** Делит список на части по size элементов */
const chunks = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size)
  );

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const isQuotaError = error =>
  error?.name === 'QuotaExceededError' ||
  error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
  error?.code === 22;

/** Сохраняет текст файлом через ссылку на Blob */
const downloadText = (text, name, type = 'application/json') => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  /** Safari начинает скачивание асинхронно и теряет файл при немедленном отзыве ссылки */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Время резервной копии: число, 0 для копии без даты, null если копии нет */
const readBackupAt = () => {
  if (!localStorage.getItem(BACKUP_KEY)) return null;
  return Number(localStorage.getItem(BACKUP_AT_KEY)) || 0;
};

/**
 * Читает архив из localStorage.
 * Нечитаемые данные откладываются в резервную копию, приложение стартует с пустым архивом.
 */
const readLocalArchive = () => {
  const saved = localStorage.getItem('habitArchive');
  if (!saved) return {};
  try {
    const archive = JSON.parse(saved);
    if (isValidArchive(archive)) return prepareArchive(archive);
  } catch (error) {
    console.error(error);
  }
  try {
    localStorage.setItem(BACKUP_KEY, saved);
    localStorage.setItem(BACKUP_AT_KEY, String(Date.now()));
  } catch (error) {
    console.error(error);
  }
  return {};
};

/** Хранилище состояния приложения "Трекер привычек" */
export const useHabitStore = defineStore('habit', {
  state: () => {
    const realDate = new Date();
    const archive = readLocalArchive();
    const savedTheme = localStorage.getItem('theme') || 'system';
    const savedLang = localStorage.getItem('lang') || 'system';
    const savedWeekStart = localStorage.getItem('weekStart') || 'monday';
    const savedShowWeekSeparators = localStorage.getItem('showWeekSeparators') !== 'false';
    const savedCalculationMode = localStorage.getItem('calculationMode') || 'fullMonth';

    return {
      /** Реальная текущая дата (не меняется при переключении месяцев) */
      realDate,
      /** Текущая отображаемая дата (может быть прошлым/будущим месяцем) */
      currentDate: realDate,
      /** Архив всех месяцев: { 'YYYY-MM': { tasks: [...] } } */
      archive,
      /** Задачи текущего отображаемого месяца */
      tasks: archive[monthKey(realDate)]?.tasks || [],
      /** Текущая тема: 'light' | 'dark' | 'system' */
      theme: savedTheme,
      /** Язык интерфейса: 'ru' | 'en' | 'ar' | 'es' | 'zh' | 'system' */
      lang: savedLang,
      /** День начала недели: 'monday' | 'sunday' */
      weekStart: savedWeekStart,
      /** Показывать ли вертикальные разделители недель */
      showWeekSeparators: savedShowWeekSeparators,
      /** Режим расчёта прогресса: 'fullMonth' | 'passedDays' */
      calculationMode: savedCalculationMode,
      /** Авторизация */
      user: null,
      isAuthReady: false,
      /**
       * Месяцы, где версии устройства и облака разошлись и ждут выбора пользователя:
       * { months: { key: { tasks|null (повреждён), revision, updatedAt, source: 'cloud'|'legacy' } } }.
       * Остальные месяцы синхронизируются как обычно.
       */
      cloudConflict: null,
      /**
       * Состояние синхронизации: 'off' без входа, 'connecting' чтение облака после входа,
       * 'conflict' ждёт выбора версии, 'pending' есть несохранённые правки, 'saving' идёт запись,
       * 'synced', 'offline' нет сети, 'error' сбой (код в syncError)
       */
      syncState: 'off',
      /** Код последней ошибки облака: код Firestore или 'too-large'; null после успешной записи */
      syncError: null,
      /** Ошибка записи в localStorage: 'quota' | 'unknown' | null */
      localSaveError: null,
      /** Время резервной копии архива (см. readBackupAt) */
      backupAt: readBackupAt(),
      /** Разобранный файл импорта, ждущий подтверждения: { source, archive, settings, truncated } */
      pendingImport: null,
      /** Шаги отмены и повтора: { id, label, viewKey, months, settings } */
      undoStack: [],
      redoStack: [],
      /** Последний автоперенос привычек в новый месяц для тоста: { from, count, id } */
      lastCarry: null,
      /**
       * Служебное состояние синхронизации, без реактивности: meta – метаданные (SYNC_META_KEY),
       * rootNeedsWrite – корневой документ ещё нужно записать (новая структура, миграция, его нет),
       * unsubscribers – отписки от onSnapshot, пусто без подписки;
       * listenFailed – подписка оборвалась ошибкой, повтор начинается со сверки заново
       */
      sync: markRaw({
        meta: emptySyncMeta(null),
        rootNeedsWrite: false,
        unsubscribers: [],
        listenFailed: false,
      }),
    };
  },

  getters: {
    /** Текущий месяц (0–11) */
    currentMonth: state => state.currentDate.getMonth(),

    /** Текущий год */
    currentYear: state => state.currentDate.getFullYear(),

    /** Ключ отображаемого месяца в архиве */
    currentMonthKey: state => monthKey(state.currentDate),

    /** Ключ реального текущего месяца в архиве */
    realMonthKey: state => monthKey(state.realDate),

    /** Количество дней в текущем месяце */
    daysInMonth: state => {
      const year = state.currentYear;
      const month = state.currentMonth;
      return new Date(year, month + 1, 0).getDate();
    },

    /** Название текущего месяца с заглавной буквы */
    monthName: state => {
      const month = new Date(state.currentYear, state.currentMonth).toLocaleString(
        resolveLang(state.lang),
        {
          month: 'long',
        }
      );
      return month.charAt(0).toUpperCase() + month.slice(1);
    },

    /** Номер текущего дня в месяце (или последний день, если просматриваем прошлый месяц) */
    today: state => {
      const today = state.realDate.getDate();
      return state.currentMonth === state.realDate.getMonth() &&
        state.currentYear === state.realDate.getFullYear()
        ? today
        : state.daysInMonth;
    },

    /** Месяц для расчётов по отметкам (src/utils/habitMath.js) */
    monthCtx: state => ({
      year: state.currentYear,
      month: state.currentMonth,
      days: state.daysInMonth,
      maxDay: state.calculationMode === 'fullMonth' ? state.daysInMonth : state.today,
      firstWeekday: state.weekStart === 'monday' ? 1 : 0,
    }),

    /** Средний процент выполнения задач; привычки на паузе не учитываются */
    overallProgress: state => {
      const active = state.tasks.filter(task => !task.paused);
      if (active.length === 0) return 0.0;
      const totalProgress = active.reduce((sum, task) => sum + (parseFloat(task.progress) || 0), 0);
      return (totalProgress / active.length).toFixed(1);
    },

    /** Оценка по 5-балльной шкале на основе среднего прогресса */
    overallGrade: state => {
      const progress = parseFloat(state.overallProgress);
      if (isNaN(progress)) return '2';
      if (progress >= 90) return '5';
      if (progress >= 70) return '4';
      if (progress >= 50) return '3';
      return '2';
    },

    /** Настройки для облака и файла экспорта */
    settings: state =>
      Object.fromEntries(Object.keys(SETTINGS_VALUES).map(key => [key, state[key]])),

    canUndo: state => state.undoStack.length > 0,

    canRedo: state => state.redoStack.length > 0,

    /** id последнего шага отмены: тост с кнопкой «Отменить» отменяет именно его */
    lastChangeId: state => state.undoStack.at(-1)?.id ?? null,
  },

  actions: {
    /** Подзадача с пустыми отметками на текущий месяц */
    createSubtask() {
      return { id: createId(), marks: Array(this.daysInMonth).fill(null) };
    },

    /**
     * Добавляет задачу с заданным числом подзадач, false при достижении лимита.
     * @param {Object} fields - необязательные поля: color, emoji, schedule, goal, paused
     */
    addTask(title, subtaskCount = 1, fields = {}) {
      if (this.tasks.length >= MAX_TASKS) return false;

      const count = Math.min(Math.max(subtaskCount, 1), MAX_SUBTASKS);
      this.recordChange('add');
      const task = repairTaskFields({
        id: createId(),
        title: title.trim().slice(0, MAX_TITLE),
        subtasks: Array.from({ length: count }, () => this.createSubtask()),
        progress: 0.0,
        ...pickTaskFields(fields),
      });
      this.tasks.push(task);
      applySchedule(task, this.monthCtx);
      this.updateTaskProgress(task.id);
      this.saveState();
      return true;
    },

    /**
     * Меняет название, число подзадач (лишние удаляются с конца вместе с отметками)
     * и необязательные поля задачи (color, emoji, schedule, goal, paused; undefined – убрать).
     */
    updateTask(taskId, title, subtaskCount, fields) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;

      const count = Math.min(Math.max(subtaskCount, 1), MAX_SUBTASKS);
      const newTitle = title.trim().slice(0, MAX_TITLE) || task.title;
      const newFields = fields
        ? repairTaskFields({ ...pickTaskFields(task), ...pickTaskFields(fields, true) })
        : pickTaskFields(task);
      if (
        newTitle === task.title &&
        count === task.subtasks.length &&
        sameTaskFields(newFields, task)
      ) {
        return;
      }

      this.recordChange('edit');
      const previousSchedule = task.schedule ?? null;
      const goalBefore = goalWeeks(task, this.monthCtx);
      task.title = newTitle;
      TASK_FIELDS.forEach(key => {
        if (newFields[key] === undefined) delete task[key];
        else task[key] = newFields[key];
      });
      if (task.subtasks.length > count) task.subtasks.splice(count);
      while (task.subtasks.length < count) {
        task.subtasks.push(this.createSubtask());
      }
      applySchedule(task, this.monthCtx, previousSchedule);
      applyGoal(task, this.monthCtx, goalBefore);
      this.updateTaskProgress(taskId);
      this.saveState();
    },

    /** Ставит или снимает паузу привычки */
    togglePause(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;
      this.recordChange('pause');
      if (task.paused) delete task.paused;
      else task.paused = true;
      this.saveState();
    },

    /**
     * Заметка к дню задачи; пустой текст удаляет её. Заметки, как и отметки, только до сегодня.
     * @returns {boolean} false, если день ещё не наступил или задачи нет
     */
    setNote(taskId, dayIndex, text) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task || dayIndex < 0 || dayIndex >= this.today) return false;
      const value = text.trim().slice(0, MAX_NOTE);
      if ((task.notes?.[dayIndex] || '') === value) return true;
      this.recordChange('note');
      task.notes = { ...task.notes, [dayIndex]: value };
      repairTaskFields(task);
      this.saveState();
      return true;
    },

    /** Сдвигает задачу в списке на offset позиций */
    moveTask(taskId, offset) {
      const from = this.tasks.findIndex(t => t.id === taskId);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= this.tasks.length) return;
      this.recordChange('move');
      const [task] = this.tasks.splice(from, 1);
      this.tasks.splice(to, 0, task);
      this.saveState();
    },

    /** Ставит задачи в порядке list (перетаскивание строк) */
    reorderTasks(list) {
      if (
        list.length !== this.tasks.length ||
        list.every((task, i) => task.id === this.tasks[i].id)
      ) {
        return;
      }
      this.recordChange('move');
      this.tasks.splice(0, this.tasks.length, ...list);
      this.saveState();
    },

    /**
     * Пересчитывает прогресс задачи по отметкам подзадач с учётом режима расчёта,
     * расписания и цели (формулы в taskProgress)
     */
    updateTaskProgress(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;
      const progress = taskProgress(task, this.monthCtx);
      task.progress = progress === null ? 0.0 : progress.toFixed(1);
    },

    /** Обновляет отметку в конкретный день подзадачи */
    updateMark(taskId, subtaskId, dayIndex, state) {
      const task = this.tasks.find(t => t.id === taskId);
      const subtask = task?.subtasks.find(s => s.id === subtaskId);
      if (!subtask || dayIndex >= this.today || subtask.marks[dayIndex] === state) return;
      this.recordChange('mark');
      const goalBefore = goalWeeks(task, this.monthCtx);
      subtask.marks[dayIndex] = state;
      applyGoal(task, this.monthCtx, goalBefore);
      this.updateTaskProgress(taskId);
      this.saveState();
    },

    /** Клик по отметке: пусто → выполнено → пропуск → пусто */
    cycleMark(taskId, subtaskId, dayIndex) {
      const mark = this.tasks.find(t => t.id === taskId)?.subtasks.find(s => s.id === subtaskId)
        ?.marks[dayIndex];
      const next = mark === null || mark === undefined ? true : mark === true ? false : null;
      this.updateMark(taskId, subtaskId, dayIndex, next);
    },

    /** Правый клик по отметке: пропуск ставится или снимается */
    toggleSkip(taskId, subtaskId, dayIndex) {
      const mark = this.tasks.find(t => t.id === taskId)?.subtasks.find(s => s.id === subtaskId)
        ?.marks[dayIndex];
      this.updateMark(taskId, subtaskId, dayIndex, mark === false ? null : false);
    },

    /** Ставит всем подзадачам за день отметку state, а если она уже стоит у всех, очищает день */
    toggleDay(dayIndex, state) {
      const allSet = this.tasks.every(task =>
        task.subtasks.every(s => s.marks[dayIndex] === state)
      );
      this.updateHeaderDay(dayIndex, allSet ? null : state);
    },

    /** Устанавливает одинаковую отметку для всех подзадач в выбранный день */
    updateHeaderDay(dayIndex, state) {
      if (dayIndex >= this.today || this.tasks.length === 0) return;
      this.recordChange('day');
      this.tasks.forEach(task => {
        const goalBefore = goalWeeks(task, this.monthCtx);
        task.subtasks.forEach(subtask => {
          subtask.marks[dayIndex] = state;
        });
        applyGoal(task, this.monthCtx, goalBefore);
      });
      this.tasks.forEach(task => this.updateTaskProgress(task.id));
      this.saveState();
    },

    /**
     * Переносит отметки с фото бланка: entries = [{ taskId, rows: marks[] по подзадачам }].
     * Для прошедших дней и сегодня фото главнее, будущие дни не трогаются.
     */
    applyScannedMarks(entries) {
      this.recordChange('scan');
      entries.forEach(({ taskId, rows }) => {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        rows.forEach((marks, row) => {
          const subtask = task.subtasks[row];
          if (!subtask) return;
          marks.forEach((mark, dayIndex) => {
            if (dayIndex < this.today) subtask.marks[dayIndex] = mark;
          });
        });
        /** На бланке дни вне расписания и закрытые целью пустые: пропуски возвращаются */
        applySchedule(task, this.monthCtx);
        applyGoal(task, this.monthCtx, []);
        this.updateTaskProgress(taskId);
      });
      this.saveState();
    },

    /** Удаляет задачу по ID; вернуть её можно через undo */
    deleteTask(taskId) {
      const index = this.tasks.findIndex(t => t.id === taskId);
      if (index < 0) return false;
      this.recordChange('delete');
      this.tasks.splice(index, 1);
      this.saveState();
      return true;
    },

    /**
     * Переносит привычки месяца from в реальный текущий без отметок и заметок
     * и переключается на него.
     * @param {Object} options - taskIds: какие задачи перенести (по умолчанию все);
     *   replace: заменить привычки текущего месяца, иначе добавить к ним
     * @returns {boolean} false, если переносить нечего или будет превышен лимит
     */
    carryOver(from, { taskIds = null, replace = true } = {}) {
      const key = this.realMonthKey;
      const source = (this.monthTasks(from) || []).filter(
        task => !taskIds || taskIds.includes(task.id)
      );
      const kept = replace ? [] : this.monthTasks(key) || [];
      if (from === key || source.length === 0 || kept.length + source.length > MAX_TASKS) {
        return false;
      }
      this.recordChange('duplicate', [key]);
      const copies = clone(source);
      this.saveState();
      this.currentDate = new Date(this.realDate);
      this.tasks = [...kept, ...carryTasks(copies, this.daysInMonth, () => createId())];
      this.adaptMarksToNewMonth();
      this.saveState();
      return true;
    },

    /**
     * Новый текущий месяц, который ещё ни разу не открывался, получает привычки последнего
     * месяца с привычками. id одинаковы на всех устройствах (carryId): два устройства,
     * перенёсшие привычки независимо, получают совпадающие данные. Удалённые потом привычки
     * не возвращаются: месяц уже есть в архиве, хоть и пустой.
     */
    autoCarryOver() {
      const key = this.realMonthKey;
      if (this.currentMonthKey !== key || this.tasks.length > 0 || this.archive[key]) return;
      const from = lastFilledBefore(this.archive, key);
      if (!from) return;
      this.recordChange('carry');
      this.tasks = carryTasks(this.archive[from].tasks, this.daysInMonth, (id, index) =>
        carryId(key, id, index)
      );
      this.adaptMarksToNewMonth();
      this.saveState();
      this.lastCarry = { from, count: this.tasks.length, id: this.lastChangeId };
    },

    /** Задачи месяца key: у открытого месяца – рабочий список, у остальных – из архива */
    monthTasks(key) {
      return key === this.currentMonthKey ? this.tasks : (this.archive[key]?.tasks ?? null);
    },

    /** Снимок месяцев keys (и настроек) для шага отмены */
    snapshot(label, keys, withSettings) {
      return markRaw({
        id: ++historyId,
        label,
        viewKey: this.currentMonthKey,
        months: Object.fromEntries(keys.map(key => [key, clone(this.monthTasks(key))])),
        settings: withSettings ? { ...this.settings } : null,
      });
    },

    /**
     * Запоминает состояние месяцев keys перед изменением.
     * @param {string} label - вид действия для подписи в тосте ('mark', 'day', 'import' …)
     */
    recordChange(label, keys = [this.currentMonthKey], withSettings = false) {
      this.undoStack.push(this.snapshot(label, keys, withSettings));
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack = [];
    },

    /** Возвращает месяцы (и настройки) из шага и открывает месяц, где шаг был сделан */
    restoreEntry(entry) {
      const reverse = this.snapshot(entry.label, Object.keys(entry.months), !!entry.settings);
      this.archive[this.currentMonthKey] = { tasks: this.tasks };
      Object.entries(entry.months).forEach(([key, tasks]) => {
        if (tasks) this.archive[key] = { tasks: clone(tasks) };
        else delete this.archive[key];
      });
      if (entry.settings) this.applySettings(entry.settings);
      if (entry.viewKey !== this.currentMonthKey) {
        const [year, month] = entry.viewKey.split('-').map(Number);
        this.currentDate =
          entry.viewKey === this.realMonthKey ? new Date(this.realDate) : new Date(year, month - 1);
      }
      this.tasks = this.archive[this.currentMonthKey]?.tasks || [];
      this.adaptMarksToNewMonth();
      this.saveState();
      return reverse;
    },

    /** Отменяет последний шаг; возвращает его label или null */
    undo() {
      const entry = this.undoStack.pop();
      if (!entry) return null;
      this.redoStack.push(this.restoreEntry(entry));
      return entry.label;
    },

    /** Повторяет отменённый шаг; возвращает его label или null */
    redo() {
      const entry = this.redoStack.pop();
      if (!entry) return null;
      this.undoStack.push(this.restoreEntry(entry));
      return entry.label;
    },

    /** Отменяет шаги до шага id включительно; false, если шаг уже вышел из истории */
    undoTo(id) {
      if (!this.undoStack.some(entry => entry.id === id)) return false;
      let entry;
      do {
        entry = this.undoStack.at(-1);
        this.undo();
      } while (entry.id !== id);
      return true;
    },

    clearHistory() {
      this.undoStack = [];
      this.redoStack = [];
    },

    /** Сохраняет текущее состояние: localStorage и Firestore с задержкой на серию правок */
    saveState() {
      this.archive[this.currentMonthKey] = { tasks: this.tasks };
      clearTimeout(localSaveTimer);
      localSaveTimer = setTimeout(() => this.saveLocal(), LOCAL_SAVE_DELAY);
      this.scheduleCloudSave();
    },

    /** Пишет настройки и архив в localStorage; false, если браузер отказал */
    saveLocal() {
      clearTimeout(localSaveTimer);
      localSaveTimer = null;
      try {
        Object.keys(SETTINGS_VALUES).forEach(key => localStorage.setItem(key, this[key]));
        localStorage.setItem('habitArchive', JSON.stringify(this.archive));
        this.localSaveError = null;
        return true;
      } catch (error) {
        console.error(error);
        this.localSaveError = isQuotaError(error) ? 'quota' : 'unknown';
        return false;
      }
    },

    /** Немедленно пишет отложенное сохранение в localStorage (закрытие или сворачивание вкладки) */
    flushLocalSave() {
      if (localSaveTimer) this.saveLocal();
    },

    /** Копия текущего архива перед импортом: переживает перезагрузку, в отличие от undo */
    writeBackup() {
      if (countTasks(this.archive) === 0) return;
      try {
        const now = Date.now();
        localStorage.setItem(BACKUP_KEY, JSON.stringify(this.archive));
        localStorage.setItem(BACKUP_AT_KEY, String(now));
        this.backupAt = now;
      } catch (error) {
        console.error(error);
      }
    },

    /** Сохраняет резервную копию файлом как есть, даже если она не читается */
    downloadBackup() {
      const saved = localStorage.getItem(BACKUP_KEY);
      if (saved) downloadText(saved, exportFileName(new Date(), 'habit_backup'));
    },

    /** Открывает месяц даты date (не позже реального) с сохранением и адаптацией данных */
    openMonth(date) {
      if (monthKey(date) > this.realMonthKey) return;
      this.saveState();
      this.currentDate = date;
      this.tasks = this.archive[this.currentMonthKey]?.tasks || [];
      this.adaptMarksToNewMonth();
      this.autoCarryOver();
      this.saveState();
    },

    /** Переход к предыдущему месяцу */
    prevMonth() {
      this.openMonth(new Date(this.currentYear, this.currentMonth - 1, 1));
    },

    /** Переход к следующему месяцу (не дальше текущего реального) */
    nextMonth() {
      this.openMonth(new Date(this.currentYear, this.currentMonth + 1, 1));
    },

    /** Переход к реальному текущему месяцу */
    goToToday() {
      if (this.currentMonthKey !== this.realMonthKey) this.openMonth(new Date(this.realDate));
    },

    /**
     * Обновляет реальную дату, если наступил новый день (PWA может быть открыта сутками).
     * С реального месяца при его смене переключается на новый.
     */
    syncRealDate() {
      const now = new Date();
      if (now.toDateString() === this.realDate.toDateString()) return;

      const wasOnRealMonth = this.currentMonthKey === this.realMonthKey;
      this.realDate = now;

      if (wasOnRealMonth && this.currentMonthKey !== this.realMonthKey) {
        this.saveState();
        this.currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
        this.tasks = this.archive[this.currentMonthKey]?.tasks || [];
        this.adaptMarksToNewMonth();
        this.autoCarryOver();
      } else {
        this.tasks.forEach(task => this.updateTaskProgress(task.id));
      }
      this.saveState();
    },

    /** Адаптирует массивы отметок и заметки под новый размер месяца */
    adaptMarksToNewMonth() {
      const newDays = this.daysInMonth;
      this.tasks.forEach(task => {
        if (task.notes) {
          Object.keys(task.notes).forEach(day => {
            if (Number(day) >= newDays) delete task.notes[day];
          });
          repairTaskFields(task);
        }
        task.subtasks.forEach(subtask => {
          const oldMarks = subtask.marks || Array(newDays).fill(null);
          subtask.marks = Array(newDays).fill(null);
          const minLength = Math.min(oldMarks.length, newDays);
          for (let i = 0; i < minLength; i++) {
            subtask.marks[i] = oldMarks[i];
          }
        });
        /** Новые дни (перенос, другой месяц) получают пропуски вне расписания */
        applySchedule(task, this.monthCtx);
        this.updateTaskProgress(task.id);
      });
    },

    /** Сохраняет архив и настройки файлом; возвращает имя файла */
    exportData() {
      const name = exportFileName(new Date());
      const data = {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        settings: this.settings,
        archive: this.archive,
      };
      downloadText(JSON.stringify(data), name);
      return name;
    },

    /**
     * Сохраняет таблицу CSV: открытый месяц или весь архив; возвращает имя файла.
     * @param {Object} labels - подписи колонок на языке интерфейса (см. archiveToCsv)
     */
    exportCsv(scope, labels) {
      const keys =
        scope === 'month'
          ? [this.currentMonthKey]
          : Object.keys(this.archive)
              .filter(key => this.archive[key]?.tasks?.length > 0)
              .sort();
      const name = exportFileName(
        new Date(),
        scope === 'month' ? `habit_${this.currentMonthKey}` : 'habit_data',
        'csv'
      );
      const csv = archiveToCsv(this.archive, keys, {
        labels,
        realMonth: this.realMonthKey,
        realDay: this.realDate.getDate(),
      });
      downloadText(csv, name, 'text/csv;charset=utf-8');
      return name;
    },

    /**
     * Читает файл импорта и готовит его к подтверждению (pendingImport).
     * @returns {Promise<string|null>} ключ словаря с ошибкой или null при успехе
     */
    async readImportFile(file) {
      if (file.size > IMPORT_FILE_LIMIT) return 'import.tooLarge';
      let text;
      try {
        text = await file.text();
      } catch (error) {
        console.error(error);
        return 'import.error';
      }
      try {
        return this.prepareImport(JSON.parse(text), 'file');
      } catch (error) {
        console.error(error);
        return 'import.invalid';
      }
    },

    /** Готовит к восстановлению резервную копию; ключ словаря с ошибкой или null */
    readBackup() {
      try {
        const error = this.prepareImport(JSON.parse(localStorage.getItem(BACKUP_KEY)), 'backup');
        return error && 'backup.invalid';
      } catch (error) {
        console.error(error);
        return 'backup.invalid';
      }
    },

    /**
     * Проверяет данные файла (экспорт любой версии) и кладёт их в pendingImport.
     * Длинные названия из старых версий обрезаются до лимита, их число попадает в truncated.
     */
    prepareImport(data, source) {
      const { version, archive, settings } = unwrapExport(data);
      if (!Number.isInteger(version) || version < 1) return 'import.invalid';
      if (version > SCHEMA_VERSION) return 'import.newer';
      if (!isValidArchive(archive)) return 'import.invalid';
      if (countTasks(archive) === 0) return 'import.empty';

      prepareArchive(archive);
      let truncated = 0;
      Object.values(archive).forEach(month =>
        month.tasks.forEach(task => {
          if (task.title.length <= MAX_TITLE) return;
          task.title = task.title.slice(0, MAX_TITLE);
          truncated++;
        })
      );
      this.pendingImport = markRaw({ source, archive, settings, truncated });
      return null;
    },

    cancelImport() {
      this.pendingImport = null;
    },

    /**
     * Применяет pendingImport. Текущий архив до этого уходит в резервную копию и в историю отмены.
     * @param {Object} options - replace: заменить архив и настройки целиком, иначе слить по месяцам;
     *   takeIncoming: месяцы, которые при слиянии берутся из файла, хотя есть и локально
     */
    applyImport({ replace = true, takeIncoming = [] } = {}) {
      const pending = this.pendingImport;
      if (!pending) return;
      const keys = new Set([
        ...Object.keys(this.archive),
        ...Object.keys(pending.archive),
        this.currentMonthKey,
      ]);
      this.recordChange('import', [...keys], replace);
      this.writeBackup();
      this.archive = replace
        ? pending.archive
        : mergeArchives(this.archive, pending.archive, takeIncoming);
      if (replace) this.applySettings(pending.settings);
      this.pendingImport = null;
      this.tasks = this.archive[this.currentMonthKey]?.tasks || [];
      this.adaptMarksToNewMonth();
      this.saveState();
    },

    /** Применяет настройки из облака, файла или истории; недопустимые значения пропускаются */
    applySettings(settings) {
      Object.entries(SETTINGS_VALUES).forEach(([key, allowed]) => {
        const value = settings?.[key];
        if (allowed.includes(value)) this[key] = value;
      });
      applyLang(this.lang);
    },

    /** Устанавливает тему и сохраняет в localStorage */
    setTheme(newTheme) {
      this.theme = newTheme;
      this.saveState();
    },

    /** Устанавливает язык интерфейса */
    setLang(newLang) {
      this.lang = newLang;
      applyLang(newLang);
      this.saveState();
    },

    /** Устанавливает день начала недели; от него зависят недели цели «N раз в неделю» */
    setWeekStart(newWeekStart) {
      this.weekStart = newWeekStart;
      this.tasks.forEach(task => this.updateTaskProgress(task.id));
      this.saveState();
    },

    /** Включает/выключает отображение разделителей недель */
    setShowWeekSeparators(newValue) {
      this.showWeekSeparators = newValue;
      this.saveState();
    },

    /** Устанавливает режим расчёта прогресса и пересчитывает все задачи */
    setCalculationMode(mode) {
      if (!['fullMonth', 'passedDays'].includes(mode)) return;
      this.calculationMode = mode;
      this.tasks.forEach(task => this.updateTaskProgress(task.id));
      this.saveState();
    },

    /** Авторизация через гугл */
    async loginWithGoogle() {
      await signInWithPopup(auth, provider);
    },

    /**
     * Логаут: данные остаются в облаке, локальные очищаются (устройство может быть общим).
     * Без force выходит только после подтверждённой записи в облако.
     * @returns {Promise<boolean>} false, если облако не подтвердило запись и выход отменён
     */
    async logout({ force = false } = {}) {
      if (!force) {
        const saved = await Promise.race([
          this.flushCloudSave(),
          wait(LOGOUT_SAVE_TIMEOUT).then(() => false),
        ]);
        if (!saved) return false;
      }
      this.unsubscribeCloud();
      await signOut(auth);
      clearTimeout(localSaveTimer);
      clearTimeout(cloudSaveTimer);
      clearTimeout(retryTimer);
      localSaveTimer = null;
      cloudSaveTimer = null;
      cloudDirty = false;
      this.sync.rootNeedsWrite = false;
      this.sync.meta = emptySyncMeta(null);
      this.user = null;
      this.cloudConflict = null;
      this.syncState = 'off';
      this.syncError = null;
      this.archive = {};
      this.tasks = [];
      this.pendingImport = null;
      this.lastCarry = null;
      this.clearHistory();
      localStorage.removeItem('habitArchive');
      localStorage.removeItem(SYNC_META_KEY);
      localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(BACKUP_AT_KEY);
      this.backupAt = null;
      return true;
    },

    /** Автовосстановление сессии */
    initAuth() {
      onAuthStateChanged(auth, user => {
        if (user?.uid !== this.user?.uid) this.clearHistory();
        authGeneration++;
        this.unsubscribeCloud();
        clearTimeout(retryTimer);
        retryAttempt = 0;
        this.user = user;
        this.isAuthReady = false;
        this.cloudConflict = null;
        this.syncError = null;

        if (!user) {
          this.isAuthReady = true;
          this.syncState = 'off';
          return;
        }
        this.connectCloud();
      });
    },

    /**
     * Читает облако после входа и сверяет его с устройством по месяцам (planConnect):
     * неизменённые на устройстве месяцы берутся из облака, изменённые только здесь – отправляются,
     * изменённые с обеих сторон ждут выбора пользователя. Старый документ с полем archive
     * вливается в подколлекцию (mergeLegacy), само поле не удаляется.
     * Запись в облако открывается только после этого: до чтения в сторе локальные данные.
     */
    async connectCloud() {
      const generation = authGeneration;
      const uid = this.user.uid;
      this.unsubscribeCloud();
      this.syncState = 'connecting';
      try {
        const [rootSnap, monthsSnap] = await Promise.all([
          getDoc(rootRef(uid)),
          getDocs(monthsRef(uid)),
        ]);
        if (generation !== authGeneration) return;

        this.sync.meta = loadSyncMeta(uid);
        const root = rootSnap.exists() ? rootSnap.data() : null;
        const months = {};
        monthsSnap.forEach(snap => {
          if (!isMonthKey(snap.id)) return;
          months[snap.id] = readMonthDoc(snap.id, snap.data());
          this.rememberLegacy(snap.id, months[snap.id]);
        });

        let cloud = months;
        const isLegacyRoot = !!root && !(root.schemaVersion >= CLOUD_SCHEMA_VERSION);
        if (isLegacyRoot && root.archive) {
          if (isValidArchive(root.archive)) {
            const legacy = mergeLegacy(prepareArchive(root.archive), months);
            cloud = legacy.cloud;
            Object.entries(legacy.absorbed).forEach(([key, hash]) => {
              this.sync.meta.legacy[key] = { hash, revision: null, pending: true };
            });
          } else {
            console.error('Legacy cloud archive is damaged and was skipped');
          }
        }
        this.sync.rootNeedsWrite = !root || isLegacyRoot;

        this.applyCloudSettings(root?.settings);
        this.applyConnectPlan(cloud);
        this.isAuthReady = true;
        saveSyncMeta(this.sync.meta);
        this.subscribeCloud();
        if (this.cloudConflict) this.syncState = 'conflict';
        await this.saveToCloud();
      } catch (error) {
        if (generation !== authGeneration) return;
        console.error(error);
        this.handleSyncError(error);
      }
    },

    /** Применяет сверку после входа к архиву и метаданным синхронизации */
    applyConnectPlan(cloud) {
      const plan = planConnect(this.archive, cloud, this.sync.meta.months);
      const remember = (key, remote, hash) => {
        this.sync.meta.months[key] = {
          revision: remote.revision,
          hash,
          device: remote.deviceId ?? null,
        };
      };

      Object.entries(plan.take).forEach(([key, remote]) => {
        this.setMonthTasks(key, remote.tasks);
        remember(key, remote, remote.unsaved ? null : hashTasks(remote.tasks));
      });
      Object.entries(plan.same).forEach(([key, remote]) =>
        remember(key, remote, remote.unsaved ? null : hashTasks(remote.tasks))
      );
      /** Отправляемый месяц пишется поверх известной облачной ревизии */
      plan.upload.forEach(key => {
        if (cloud[key]) remember(key, cloud[key], null);
      });

      const conflicts = Object.keys(plan.conflicts);
      this.cloudConflict = conflicts.length > 0 ? markRaw({ months: plan.conflicts }) : null;
      if (Object.keys(plan.take).length > 0) this.saveLocal();
    },

    /** Запоминает, какая версия старого архива уже влита в месяц (поля legacyHash/legacyRevision) */
    rememberLegacy(key, remote) {
      if (remote.legacyHash && !this.sync.meta.legacy[key]?.pending) {
        this.sync.meta.legacy[key] = {
          hash: remote.legacyHash,
          revision: remote.legacyRevision ?? 0,
        };
      }
    },

    /** Кладёт задачи месяца из облака в архив; открытый месяц сразу показывает их */
    setMonthTasks(key, tasks) {
      this.archive[key] = { tasks: clone(tasks) };
      if (key === this.currentMonthKey) {
        this.tasks = this.archive[key].tasks;
        this.adaptMarksToNewMonth();
      }
    },

    /** Настройки из облака применяются, если на устройстве их не меняли после прошлой синхронизации */
    applyCloudSettings(settings) {
      const localChanged =
        this.sync.meta.settingsHash !== null &&
        hashSettings(this.settings) !== this.sync.meta.settingsHash;
      if (!settings || localChanged) return;
      const before = hashSettings(this.settings);
      this.applySettings(settings);
      if (hashSettings(this.settings) !== before) {
        this.tasks.forEach(task => this.updateTaskProgress(task.id));
        this.saveLocal();
      }
      /** Неполные или недопустимые настройки облака не делают локальные «изменёнными» */
      this.sync.meta.settingsHash = hashSettings(this.settings);
    },

    /** Подписка на изменения корня и месяцев с других устройств */
    subscribeCloud() {
      const uid = this.user.uid;
      const generation = authGeneration;
      const onError = error => {
        if (generation !== authGeneration) return;
        console.error(error);
        this.unsubscribeCloud();
        this.sync.listenFailed = true;
        this.handleSyncError(error);
      };
      this.sync.listenFailed = false;
      this.sync.unsubscribers = [
        onSnapshot(
          rootRef(uid),
          snap => generation === authGeneration && this.handleRootSnapshot(snap),
          onError
        ),
        onSnapshot(
          monthsRef(uid),
          snap => {
            if (generation !== authGeneration) return;
            snap.docChanges().forEach(change => this.handleMonthChange(change));
          },
          onError
        ),
      ];
    },

    unsubscribeCloud() {
      this.sync.unsubscribers.forEach(unsubscribe => unsubscribe());
      this.sync.unsubscribers = [];
    },

    /**
     * Корневой документ изменился на другом устройстве: новые настройки
     * или запись клиента старой версии (без schemaVersion) – тогда сверка проводится заново.
     */
    handleRootSnapshot(snap) {
      if (!snap.exists() || snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
      const data = snap.data();
      if (data.deviceId === DEVICE_ID) return;
      if (!(data.schemaVersion >= CLOUD_SCHEMA_VERSION) && data.archive) {
        this.connectCloud();
        return;
      }
      if (hashSettings(data.settings) === this.sync.meta.settingsHash) return;
      this.applyCloudSettings(data.settings);
      saveSyncMeta(this.sync.meta);
    },

    /**
     * Месяц изменился в облаке. Свои записи пропускаются; чужая версия берётся, если на устройстве
     * месяц не менялся, иначе месяц попадает в конфликт и не пишется до выбора (classifyRemote).
     */
    handleMonthChange(change) {
      const snap = change.doc;
      if (change.type === 'removed' || !isMonthKey(snap.id)) return;
      if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
      const data = snap.data();
      if (data.deviceId === DEVICE_ID) return;

      const key = snap.id;
      const remote = readMonthDoc(key, data);
      this.rememberLegacy(key, remote);

      if (this.cloudConflict?.months[key]) {
        this.cloudConflict = markRaw({
          months: { ...this.cloudConflict.months, [key]: remote },
        });
        return;
      }

      const known = this.sync.meta.months[key];
      const result = classifyRemote(this.monthTasks(key) || [], remote, known);
      if (result === 'ignore') return;
      if (result === 'conflict') {
        this.cloudConflict = markRaw({ months: { ...this.cloudConflict?.months, [key]: remote } });
        this.syncState = 'conflict';
        return;
      }
      if (result === 'take') {
        this.setMonthTasks(key, remote.tasks);
        this.saveLocal();
      }
      this.sync.meta.months[key] = {
        revision: remote.revision,
        hash: hashTasks(remote.tasks),
        device: remote.deviceId,
      };
      saveSyncMeta(this.sync.meta);
    },

    /**
     * Решает конфликт по месяцам.
     * @param {boolean|Object} choice - true: все месяцы с устройства, false: все из облака,
     *   { key: 'local' | 'cloud' } – по месяцам. Повреждённый облачный месяц можно только перезаписать.
     */
    resolveCloudConflict(choice) {
      const conflict = this.cloudConflict;
      if (!conflict) return;
      const pick = key =>
        typeof choice === 'boolean' ? (choice ? 'local' : 'cloud') : choice[key];
      const entries = Object.entries(conflict.months);
      const resolved = entries.filter(
        ([key, remote]) => pick(key) === 'local' || (pick(key) === 'cloud' && remote.tasks)
      );
      if (resolved.length === 0) return;

      const fromCloud = resolved.filter(([key]) => pick(key) === 'cloud');
      if (fromCloud.length > 0) {
        this.recordChange(
          'cloud',
          fromCloud.map(([key]) => key)
        );
      }
      resolved.forEach(([key, remote]) => {
        const takeCloud = pick(key) === 'cloud';
        if (takeCloud) this.setMonthTasks(key, remote.tasks);
        /** Своя версия пишется поверх облачной ревизии; старая версия ещё не лежит в подколлекции */
        this.sync.meta.months[key] = {
          revision: remote.revision ?? 0,
          hash: takeCloud && !remote.unsaved ? hashTasks(remote.tasks) : null,
          device: remote.deviceId ?? null,
        };
      });

      const rest = entries.filter(([key]) => !resolved.some(([done]) => done === key));
      this.cloudConflict = rest.length > 0 ? markRaw({ months: Object.fromEntries(rest) }) : null;
      saveSyncMeta(this.sync.meta);
      if (fromCloud.length > 0) this.saveLocal();
      this.isAuthReady = true;
      this.saveToCloud();
    },

    /** Планирует запись в Firestore после серии правок */
    scheduleCloudSave() {
      if (!this.user) return;
      cloudDirty = true;
      if (this.isAuthReady && !['offline', 'error', 'conflict'].includes(this.syncState)) {
        this.syncState = 'pending';
      }
      clearTimeout(cloudSaveTimer);
      cloudSaveTimer = setTimeout(() => this.flushCloudSave(), CLOUD_SAVE_DELAY);
    },

    /**
     * Немедленно отправляет отложенные изменения в Firestore.
     * @returns {Promise<boolean>} true, если в облаке те же данные, что на устройстве
     */
    async flushCloudSave() {
      clearTimeout(cloudSaveTimer);
      cloudSaveTimer = null;
      if (!this.user) return true;
      /** Облако ещё не прочитано: локальные данные в нём могут отсутствовать */
      if (!this.isAuthReady) return countTasks(this.archive) === 0;
      const saved = cloudDirty || cloudWrite ? await this.saveToCloud() : true;
      /** Месяцы в конфликте не записаны: версия устройства есть только здесь */
      return saved && !this.cloudConflict;
    },

    /**
     * Записывает данные в Firestore. Записи идут строго по очереди: правки во время записи
     * уходят следующей записью, и более старый снимок не может лечь поверх нового.
     * @returns {Promise<boolean>} false при ошибке (статус и повтор выставлены)
     */
    saveToCloud() {
      if (!this.user || !this.isAuthReady) return Promise.resolve(false);
      cloudDirty = true;
      if (!cloudWrite) cloudWrite = this.runCloudWrites();
      return cloudWrite;
    },

    async runCloudWrites() {
      try {
        while (cloudDirty && this.user && this.isAuthReady) {
          cloudDirty = false;
          await this.writeCloud();
        }
        if (this.user) this.markSynced();
        return true;
      } catch (error) {
        cloudDirty = true;
        console.error(error);
        this.handleSyncError(error);
        return false;
      } finally {
        cloudWrite = null;
      }
    },

    /** Месяцы, отличающиеся от последней известной облачной версии; месяцы в конфликте ждут */
    dirtyMonths() {
      const keys = new Set([...Object.keys(this.archive), ...Object.keys(this.sync.meta.months)]);
      return [...keys]
        .filter(key => isMonthKey(key) && !this.cloudConflict?.months[key])
        .map(key => {
          const tasks = this.archive[key]?.tasks || [];
          return { key, tasks, hash: hashTasks(tasks) };
        })
        .filter(({ key, tasks, hash }) => {
          const known = this.sync.meta.months[key];
          return known ? known.hash !== hash : tasks.length > 0;
        });
    },

    /**
     * Пакетная запись изменённых месяцев и корня (настройки, версия структуры).
     * Ревизия месяца растёт на 1 от известной, base – ревизия, поверх которой пишет устройство.
     */
    async writeCloud() {
      const uid = this.user.uid;
      const meta = this.sync.meta;
      const months = this.dirtyMonths();
      const settings = { ...this.settings };
      const settingsHash = hashSettings(settings);
      const writeRoot = this.sync.rootNeedsWrite || settingsHash !== this.sync.meta.settingsHash;
      if (months.length === 0 && !writeRoot) return;

      const now = Date.now();
      const writes = months.map(({ key, tasks, hash }) => {
        const known = this.sync.meta.months[key];
        const revision = (known?.revision || 0) + 1;
        const legacy = this.sync.meta.legacy[key];
        const data = {
          tasks,
          revision,
          base: known?.revision || 0,
          deviceId: DEVICE_ID,
          updatedAt: now,
        };
        if (legacy?.hash) {
          data.legacyHash = legacy.hash;
          data.legacyRevision = legacy.pending ? revision : legacy.revision;
        }
        const size = new TextEncoder().encode(JSON.stringify(data)).length;
        if (size > CLOUD_DOC_MAX) {
          throw Object.assign(new Error(`Cloud month ${key} is too large`), { code: 'too-large' });
        }
        return { key, data, hash };
      });

      /** Без сети Firestore держит запись в очереди и завершает её после подключения */
      this.syncState = navigator.onLine ? 'saving' : 'offline';
      const parts = writes.length > 0 ? chunks(writes, CLOUD_BATCH_SIZE) : [[]];
      for (const [index, part] of parts.entries()) {
        const batch = writeBatch(db);
        part.forEach(({ key, data }) => batch.set(monthRef(uid, key), data));
        if (writeRoot && index === parts.length - 1) {
          batch.set(
            rootRef(uid),
            { settings, schemaVersion: CLOUD_SCHEMA_VERSION, updatedAt: now, deviceId: DEVICE_ID },
            { merge: true }
          );
        }
        await batch.commit();
        /** Пока шла запись, пользователь вышел или сменился: метаданные уже не его */
        if (meta !== this.sync.meta) return;
        part.forEach(({ key, data, hash }) => {
          this.sync.meta.months[key] = { revision: data.revision, hash, device: DEVICE_ID };
          if (data.legacyHash) {
            this.sync.meta.legacy[key] = { hash: data.legacyHash, revision: data.legacyRevision };
          }
        });
        saveSyncMeta(this.sync.meta);
      }
      this.sync.meta.settingsHash = settingsHash;
      this.sync.rootNeedsWrite = false;
      saveSyncMeta(this.sync.meta);
    },

    markSynced() {
      clearTimeout(retryTimer);
      retryAttempt = 0;
      this.syncState = this.cloudConflict ? 'conflict' : 'synced';
      this.syncError = null;
    },

    /** Сеть пропала: правки копятся в очереди Firestore до её возвращения */
    markOffline() {
      if (this.user && this.isAuthReady && this.syncState !== 'error') this.syncState = 'offline';
    },

    /** Выставляет статус по ошибке Firestore и планирует повтор, если он имеет смысл */
    handleSyncError(error) {
      const code = String(error?.code || 'unknown').replace(/^firestore\//, '');
      const offline = !navigator.onLine || OFFLINE_CODES.includes(code);
      this.syncState = offline ? 'offline' : 'error';
      if (!offline) this.syncError = code;
      if (!offline && !RETRY_CODES.includes(code)) return;
      clearTimeout(retryTimer);
      const delay = RETRY_DELAYS[Math.min(retryAttempt, RETRY_DELAYS.length - 1)];
      retryAttempt++;
      retryTimer = setTimeout(() => this.resumeSync(), delay);
    },

    /** Продолжает синхронизацию с того места, где она остановилась */
    resumeSync() {
      if (!this.user) return Promise.resolve(false);
      /** Облако не прочитано или подписка оборвалась ошибкой: сверка заново */
      if (!this.isAuthReady || this.sync.listenFailed) return this.connectCloud();
      if (!cloudDirty && !cloudWrite) {
        if (navigator.onLine) this.markSynced();
        return Promise.resolve(true);
      }
      return this.saveToCloud();
    },

    /** Повтор синхронизации сразу: кнопка «Повторить» или восстановление сети */
    retrySync() {
      clearTimeout(retryTimer);
      retryAttempt = 0;
      return this.resumeSync();
    },
  },
});
