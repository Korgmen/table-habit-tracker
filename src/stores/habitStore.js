import { defineStore } from 'pinia';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, provider, db } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { resolveLang, applyLang, SUPPORTED_LANGS } from '@/i18n';
import { monthKey, decodeArchiveTitles, normalizeArchive, isValidArchive } from '@/utils/archive';

/** Лимиты задач в месяце и подзадач в задаче */
export const MAX_TASKS = 20;
export const MAX_SUBTASKS = 8;

/** Допустимые значения настроек: облачный документ применяется только по ним */
const SETTINGS_VALUES = {
  theme: ['system', 'light', 'dark'],
  lang: ['system', ...SUPPORTED_LANGS],
  weekStart: ['monday', 'sunday'],
  showWeekSeparators: [true, false],
  calculationMode: ['fullMonth', 'passedDays'],
};

/** Серия правок подряд (клики по отметкам, переход месяца) уходит в Firestore одной записью */
const CLOUD_SAVE_DELAY = 1000;
let cloudSaveTimer = null;

/**
 * Читает архив из localStorage.
 * Нечитаемые данные откладываются в habitArchiveBackup, приложение стартует с пустым архивом.
 */
const readLocalArchive = () => {
  const saved = localStorage.getItem('habitArchive');
  if (!saved) return {};
  try {
    const archive = JSON.parse(saved);
    if (isValidArchive(archive)) return decodeArchiveTitles(archive);
  } catch (error) {
    console.error(error);
  }
  localStorage.setItem('habitArchiveBackup', saved);
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
      /** Данные из Firestore, расходящиеся с локальными и ждущие выбора пользователя */
      cloudConflict: null,
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

    /** Средний процент выполнения всех задач */
    overallProgress: state => {
      if (state.tasks.length === 0) return 0.0;
      const totalProgress = state.tasks.reduce(
        (sum, task) => sum + (parseFloat(task.progress) || 0),
        0
      );
      return (totalProgress / state.tasks.length).toFixed(1);
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
  },

  actions: {
    /** Подзадача с пустыми отметками на текущий месяц */
    createSubtask(offset = 0) {
      return { id: Date.now() + offset + Math.random(), marks: Array(this.daysInMonth).fill(null) };
    },

    /** Добавляет задачу с заданным числом подзадач, false при достижении лимита */
    addTask(title, subtaskCount = 1) {
      if (this.tasks.length >= MAX_TASKS) return false;

      const count = Math.min(Math.max(subtaskCount, 1), MAX_SUBTASKS);
      this.tasks.push({
        id: Date.now(),
        title: title.trim(),
        subtasks: Array.from({ length: count }, (_, i) => this.createSubtask(i + 1)),
        progress: 0.0,
      });
      this.saveState();
      return true;
    },

    /** Переименовывает задачу и подгоняет число подзадач: лишние удаляются с конца вместе с отметками */
    updateTask(taskId, title, subtaskCount) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;

      const count = Math.min(Math.max(subtaskCount, 1), MAX_SUBTASKS);
      task.title = title.trim() || task.title;
      if (task.subtasks.length > count) task.subtasks.splice(count);
      while (task.subtasks.length < count) {
        task.subtasks.push(this.createSubtask(task.subtasks.length));
      }
      this.updateTaskProgress(taskId);
      this.saveState();
    },

    /** Сдвигает задачу в списке на offset позиций */
    moveTask(taskId, offset) {
      const from = this.tasks.findIndex(t => t.id === taskId);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= this.tasks.length) return;
      const [task] = this.tasks.splice(from, 1);
      this.tasks.splice(to, 0, task);
      this.saveState();
    },

    /** Пересчитывает прогресс задачи на основе отметок подзадач с учётом режима расчёта */
    updateTaskProgress(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;
      if (task.subtasks.length === 0) {
        task.progress = 0.0;
        return;
      }

      let totalValid = 0;
      let completed = 0;

      const maxDay = this.calculationMode === 'fullMonth' ? this.daysInMonth : this.today;

      task.subtasks.forEach(subtask => {
        for (let i = 0; i < maxDay; i++) {
          const mark = subtask.marks[i];
          if (mark === true) {
            completed++;
            totalValid++;
          } else if (mark === null) {
            totalValid++;
          }
        }
      });

      task.progress = totalValid > 0 ? ((completed / totalValid) * 100).toFixed(1) : 0.0;
    },

    /** Обновляет отметку в конкретный день подзадачи */
    updateMark(taskId, subtaskId, dayIndex, state) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        const subtask = task.subtasks.find(s => s.id === subtaskId);
        if (subtask && dayIndex < this.today) {
          subtask.marks[dayIndex] = state;
          this.updateTaskProgress(taskId);
          this.saveState();
        }
      }
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
      this.tasks.forEach(task => {
        task.subtasks.forEach(subtask => {
          if (dayIndex < this.today) {
            subtask.marks[dayIndex] = state;
          }
        });
      });
      this.tasks.forEach(task => this.updateTaskProgress(task.id));
      this.saveState();
    },

    /**
     * Переносит отметки с фото бланка: entries = [{ taskId, rows: marks[] по подзадачам }].
     * Для прошедших дней и сегодня фото главнее, будущие дни не трогаются.
     */
    applyScannedMarks(entries) {
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
        this.updateTaskProgress(taskId);
      });
      this.saveState();
    },

    /**
     * Удаляет задачу по ID.
     * @returns {{ task, index, monthKey } | null} данные для restoreTask
     */
    deleteTask(taskId) {
      const index = this.tasks.findIndex(t => t.id === taskId);
      if (index < 0) return null;
      const [task] = this.tasks.splice(index, 1);
      this.saveState();
      return { task, index, monthKey: this.currentMonthKey };
    },

    /** Возвращает удалённую задачу на прежнее место, если месяц не сменился и лимит позволяет */
    restoreTask({ task, index, monthKey: key }) {
      if (key !== this.currentMonthKey || this.tasks.length >= MAX_TASKS) return false;
      this.tasks.splice(Math.min(index, this.tasks.length), 0, task);
      this.saveState();
      return true;
    },

    /**
     * Копирует задачи открытого месяца в реальный текущий с чистыми отметками (с заменой)
     * и переключается на него.
     */
    duplicateToCurrent() {
      if (this.currentMonthKey === this.realMonthKey) return;
      const source = this.tasks;
      this.saveState();
      this.currentDate = new Date(this.realDate);
      this.tasks = source.map((task, i) => ({
        id: Date.now() + i,
        title: task.title,
        progress: 0.0,
        subtasks: task.subtasks.map((_, k) => this.createSubtask(i * MAX_SUBTASKS + k)),
      }));
      this.adaptMarksToNewMonth();
      this.saveState();
    },

    /** Сохраняет текущее состояние в localStorage и планирует запись в Firestore */
    saveState() {
      this.archive[this.currentMonthKey] = { tasks: this.tasks };
      this.saveLocal();
      clearTimeout(cloudSaveTimer);
      cloudSaveTimer = setTimeout(() => this.flushCloudSave(), CLOUD_SAVE_DELAY);
    },

    /** Пишет архив и настройки в localStorage */
    saveLocal() {
      localStorage.setItem('habitArchive', JSON.stringify(this.archive));
      Object.keys(SETTINGS_VALUES).forEach(key => localStorage.setItem(key, this[key]));
    },

    /** Немедленно отправляет отложенную запись в Firestore, если она есть */
    async flushCloudSave() {
      if (!cloudSaveTimer) return;
      clearTimeout(cloudSaveTimer);
      cloudSaveTimer = null;
      await this.saveToCloud().catch(error => console.error(error));
    },

    /** Открывает месяц даты date (не позже реального) с сохранением и адаптацией данных */
    openMonth(date) {
      if (monthKey(date) > this.realMonthKey) return;
      this.saveState();
      this.currentDate = date;
      this.tasks = this.archive[this.currentMonthKey]?.tasks || [];
      this.adaptMarksToNewMonth();
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
      } else {
        this.tasks.forEach(task => this.updateTaskProgress(task.id));
      }
      this.saveState();
    },

    /** Адаптирует массивы отметок под новый размер месяца */
    adaptMarksToNewMonth() {
      const newDays = this.daysInMonth;
      this.tasks.forEach(task => {
        task.subtasks.forEach(subtask => {
          const oldMarks = subtask.marks || Array(newDays).fill(null);
          subtask.marks = Array(newDays).fill(null);
          const minLength = Math.min(oldMarks.length, newDays);
          for (let i = 0; i < minLength; i++) {
            subtask.marks[i] = oldMarks[i];
          }
        });
        this.updateTaskProgress(task.id);
      });
    },

    /** Экспортирует весь архив как JSON-файл */
    exportData() {
      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.archive));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute('href', dataStr);
      downloadAnchorNode.setAttribute('download', 'habit_data.json');
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    },

    /**
     * Импортирует архив из файла с проверкой размера и структуры.
     * @returns {Promise<string|null>} ключ словаря с ошибкой или null при успехе
     */
    async importData(file) {
      if (file.size > 2 * 1024 * 1024) return 'import.tooLarge';
      try {
        const importedArchive = JSON.parse(await file.text());
        if (!isValidArchive(importedArchive)) return 'import.invalid';
        this.archive = decodeArchiveTitles(importedArchive);
        this.tasks = this.archive[this.currentMonthKey]?.tasks || [];
        this.adaptMarksToNewMonth();
        this.saveState();
        return null;
      } catch (error) {
        console.error(error);
        return 'import.error';
      }
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

    /** Устанавливает день начала недели */
    setWeekStart(newWeekStart) {
      this.weekStart = newWeekStart;
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

    /** Логаут: данные остаются в облаке, локальный архив очищается (устройство может быть общим) */
    async logout() {
      await this.flushCloudSave();
      await signOut(auth);
      this.user = null;
      this.cloudConflict = null;
      this.archive = {};
      this.tasks = [];
      localStorage.removeItem('habitArchive');
    },

    /** Автовосстановление сессии */
    initAuth() {
      onAuthStateChanged(auth, async user => {
        this.user = user;
        this.isAuthReady = false;

        if (!user) {
          this.isAuthReady = true;
          return;
        }

        // Запись в облако открывается только после чтения облачного архива: до этого в сторе локальные данные
        try {
          const cloudData = await this.loadFromCloud();

          if (!cloudData) {
            this.isAuthReady = true;
            await this.saveToCloud();
            return;
          }

          const localArchive = normalizeArchive(this.archive);
          const cloudArchive = normalizeArchive(decodeArchiveTitles(cloudData.archive || {}));

          if (localArchive !== '{}' && localArchive !== cloudArchive) {
            this.cloudConflict = cloudData;
            return;
          }

          this.applyCloudData(cloudData);
          this.isAuthReady = true;
        } catch (error) {
          console.error(error);
        }
      });
    },

    /**
     * Завершает конфликт локальных и облачных данных.
     * @param {boolean} keepLocal - true: локальные данные перезаписывают облако, false: облачные заменяют локальные
     */
    resolveCloudConflict(keepLocal) {
      if (!this.cloudConflict) return;
      if (!keepLocal) this.applyCloudData(this.cloudConflict);
      this.cloudConflict = null;
      this.isAuthReady = true;
      if (keepLocal) this.saveToCloud().catch(error => console.error(error));
    },

    /** Сохранение данных в Firestore */
    async saveToCloud() {
      if (!this.user || !this.isAuthReady) return;

      const ref = doc(db, 'users', this.user.uid);

      await setDoc(ref, {
        archive: this.archive,
        settings: {
          theme: this.theme,
          lang: this.lang,
          weekStart: this.weekStart,
          showWeekSeparators: this.showWeekSeparators,
          calculationMode: this.calculationMode,
        },
        updatedAt: Date.now(),
      });
    },

    /** Читает документ пользователя из Firestore, возвращает null, если его ещё нет */
    async loadFromCloud() {
      if (!this.user) return null;

      const ref = doc(db, 'users', this.user.uid);
      const snap = await getDoc(ref);

      return snap.exists() ? snap.data() : null;
    },

    /** Применяет данные из Firestore к стору и localStorage */
    applyCloudData(data) {
      this.archive = decodeArchiveTitles(data.archive || {});
      this.tasks = this.archive[this.currentMonthKey]?.tasks || [];

      Object.entries(SETTINGS_VALUES).forEach(([key, allowed]) => {
        const value = data.settings?.[key];
        if (allowed.includes(value)) this[key] = value;
      });
      applyLang(this.lang);

      this.saveLocal();
    },
  },
});
