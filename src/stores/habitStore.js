import { defineStore } from 'pinia';

/** Хранилище состояния приложения "Трекер привычек" */
export const useHabitStore = defineStore('habit', {
  state: () => {
    const realDate = new Date();
    const savedArchive = localStorage.getItem('habitArchive');
    const archive = savedArchive ? JSON.parse(savedArchive) : {};
    const currentMonthKey = `${realDate.getFullYear()}-${String(realDate.getMonth() + 1).padStart(2, '0')}`;
    const savedTheme = localStorage.getItem('theme') || 'system';
    const savedLang = localStorage.getItem('lang') || 'system';
    const savedWeekStart = localStorage.getItem('weekStart') || 'monday';
    const savedShowWeekSeparators = localStorage.getItem('showWeekSeparators') !== 'false';

    return {
      /** Реальная текущая дата (не меняется при переключении месяцев) */
      realDate,
      /** Текущая отображаемая дата (может быть прошлым/будущим месяцем) */
      currentDate: realDate,
      /** Архив всех месяцев: { 'YYYY-MM': { tasks: [...] } } */
      archive,
      /** Задачи текущего отображаемого месяца */
      tasks: archive[currentMonthKey]?.tasks || [],
      /** ID задачи, находящейся в режиме редактирования */
      editingTaskId: null,
      /** Активный режим взаимодействия: null | 'delete' | 'eraser' */
      activeMode: null,
      /** Текущая тема: 'light' | 'dark' | 'system' */
      theme: savedTheme,
      /** Язык интерфейса: 'ru' | 'en' | 'ar' | 'es' | 'zh' | 'system' */
      lang: savedLang,
      /** День начала недели: 'monday' | 'sunday' */
      weekStart: savedWeekStart,
      /** Показывать ли вертикальные разделители недель */
      showWeekSeparators: savedShowWeekSeparators,
      /** Состояние глобального модального окна */
      modal: {
        isOpen: false,
        title: '',
        message: '',
        type: 'alert',
        onConfirm: null,
        onCancel: null,
      },
      /** Флаг: видел ли пользователь приветственное сообщение */
      hasSeenWelcome: localStorage.getItem('hasSeenWelcome') === 'true',
    };
  },

  getters: {
    /** Текущий месяц (0–11) */
    currentMonth: state => state.currentDate.getMonth(),

    /** Текущий год */
    currentYear: state => state.currentDate.getFullYear(),

    /** Количество дней в текущем месяце */
    daysInMonth: state => {
      const year = state.currentYear;
      const month = state.currentMonth;
      return new Date(year, month + 1, 0).getDate();
    },

    /** Название текущего месяца с заглавной буквы */
    monthName: state => {
      let lang = 'en';
      if (state.lang === 'system') {
        const navLang = navigator.language.toLowerCase();
        if (navLang.startsWith('ru')) lang = 'ru';
        else if (navLang.startsWith('ar')) lang = 'ar';
        else if (navLang.startsWith('es')) lang = 'es';
        else if (navLang.startsWith('zh')) lang = 'zh';
      } else {
        lang = state.lang;
      }
      const month = new Date(state.currentYear, state.currentMonth).toLocaleString(lang, {
        month: 'long',
      });
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
    /** Возвращает локализованный заголовок по умолчанию для новой задачи */
    getDefaultTaskTitle() {
      let currentLang = this.lang;
      if (currentLang === 'system') {
        const navLang = navigator.language.toLowerCase();
        if (navLang.startsWith('ru')) currentLang = 'ru';
        else if (navLang.startsWith('ar')) currentLang = 'ar';
        else if (navLang.startsWith('es')) currentLang = 'es';
        else if (navLang.startsWith('zh')) currentLang = 'zh';
        else currentLang = 'en';
      }
      const titles = {
        ru: 'Новая задача',
        en: 'New task',
        ar: 'مهمة جديدة',
        es: 'Nueva tarea',
        zh: '新任务',
      };
      return titles[currentLang] || 'New task';
    },

    /** Добавляет новую задачу с одной подзадачей */
    addTask() {
      if (this.tasks.length >= 20) {
        return;
      }

      const id = Date.now();
      this.tasks.push({
        id,
        title: this.getDefaultTaskTitle(),
        subtasks: [{ id: Date.now() + 1, marks: Array(this.daysInMonth).fill(null) }],
        progress: 0.0,
      });
      this.saveState();
    },

    /** Добавляет подзадачу к указанной задаче (максимум 8) */
    addSubtask(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task && task.subtasks.length < 8) {
        task.subtasks.push({
          id: Date.now(),
          marks: Array(this.daysInMonth).fill(null),
        });
        this.updateTaskProgress(taskId);
        this.saveState();
      }
    },

    /** Начинает редактирование заголовка задачи */
    startEditing(taskId) {
      this.editingTaskId = taskId;
    },

    /** Завершает редактирование с экранированием HTML и сохранением */
    finishEditing(taskId, newTitle) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        const escapeHtml = str =>
          str.replace(
            /[&<>"']/g,
            s =>
              ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
              })[s]
          );
        task.title = escapeHtml(newTitle.trim()) || this.getDefaultTaskTitle();
        this.editingTaskId = null;
        this.saveState();
      }
    },

    /** Пересчитывает прогресс задачи на основе отметок подзадач */
    updateTaskProgress(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task && task.subtasks.length > 0) {
        const subtaskProgresses = task.subtasks.map(subtask => {
          const completed = subtask.marks.filter(
            (status, i) => status === true && i < this.today
          ).length;
          const excluded = subtask.marks.filter(
            (status, i) => status === false && i < this.today
          ).length;
          const passedDays = this.today;
          if (excluded === passedDays) {
            return 100.0;
          }
          const totalDays = Math.max(passedDays - excluded, 1);
          return (completed / totalDays) * 100;
        });
        task.progress =
          (
            subtaskProgresses.reduce((sum, p) => sum + (p || 0), 0) / subtaskProgresses.length
          ).toFixed(1) || 0.0;
      } else if (task) {
        task.progress = 0.0;
      }
      this.saveState();
    },

    /** Обновляет отметку в конкретный день подзадачи */
    updateMark(taskId, subtaskId, dayIndex, state) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        const subtask = task.subtasks.find(s => s.id === subtaskId);
        if (subtask && dayIndex < this.today) {
          subtask.marks[dayIndex] = state;
          this.updateTaskProgress(taskId);
        }
      }
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
    },

    /** Удаляет задачу по ID */
    deleteTask(taskId) {
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      this.saveState();
    },

    /** Удаляет последнюю подзадачу у задачи */
    deleteLastSubtask(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task && task.subtasks.length > 1) {
        task.subtasks.pop();
        this.updateTaskProgress(taskId);
        this.saveState();
      }
    },

    /** Переключает активный режим (удаление/стирание) */
    toggleMode(mode) {
      this.activeMode = this.activeMode === mode ? null : mode;
      this.saveState();
    },

    /** Стирает отметку в указанный день */
    eraseMark(taskId, subtaskId, dayIndex) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task && dayIndex < this.today) {
        const subtask = task.subtasks.find(s => s.id === subtaskId);
        if (subtask) {
          subtask.marks[dayIndex] = null;
          this.updateTaskProgress(taskId);
        }
      }
    },

    /** Сохраняет текущее состояние в localStorage */
    saveState() {
      const currentMonthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
      this.archive[currentMonthKey] = { tasks: this.tasks };
      localStorage.setItem('habitArchive', JSON.stringify(this.archive));
      localStorage.setItem('theme', this.theme);
      localStorage.setItem('lang', this.lang);
      localStorage.setItem('weekStart', this.weekStart);
      localStorage.setItem('showWeekSeparators', this.showWeekSeparators);
    },

    /** Переход к предыдущему месяцу с сохранением и адаптацией данных */
    prevMonth() {
      const newDate = new Date(this.currentDate);
      newDate.setMonth(this.currentMonth - 1);
      this.saveState();
      this.currentDate = newDate;
      const newMonthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
      this.tasks = this.archive[newMonthKey]?.tasks || [];
      this.adaptMarksToNewMonth();
      this.saveState();
    },

    /** Переход к следующему месяцу (не дальше текущего реального) */
    nextMonth() {
      const newDate = new Date(this.currentDate);
      newDate.setMonth(this.currentMonth + 1);
      const realMonthKey = `${this.realDate.getFullYear()}-${String(this.realDate.getMonth() + 1).padStart(2, '0')}`;
      const newMonthKey = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
      if (newMonthKey > realMonthKey) return;
      this.saveState();
      this.currentDate = newDate;
      this.tasks = this.archive[newMonthKey]?.tasks || [];
      this.adaptMarksToNewMonth();
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

    /** Импортирует архив из файла с проверкой размера и структуры */
    importData(event) {
      const file = event.target.files[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          alert('Файл слишком большой!');
          return;
        }
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const importedArchive = JSON.parse(e.target.result);
            if (!this.validateArchive(importedArchive)) {
              alert('Некорректная структура данных!');
              return;
            }
            this.archive = importedArchive;
            const currentMonthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
            this.tasks = this.archive[currentMonthKey]?.tasks || [];
            this.adaptMarksToNewMonth();
            this.saveState();
          } catch (error) {
            alert('Ошибка при импорте данных!');
            console.error(error);
          }
        };
        reader.readAsText(file);
        event.target.value = '';
      }
    },

    /** Проверяет корректность структуры импортируемого архива */
    validateArchive(archive) {
      return (
        typeof archive === 'object' &&
        Object.values(archive).every(month => month.tasks && Array.isArray(month.tasks))
      );
    },

    /** Устанавливает тему и сохраняет в localStorage */
    setTheme(newTheme) {
      this.theme = newTheme;
      this.saveState();
    },

    /** Устанавливает язык интерфейса */
    setLang(newLang) {
      this.lang = newLang;
      localStorage.setItem('lang', newLang);
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

    /** Обрабатывает долгое нажатие — ставит отметку "исключено" */
    handleLongPress(taskId, subtaskId, dayIndex) {
      if (dayIndex < this.today) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
          const subtask = task.subtasks.find(s => s.id === subtaskId);
          if (subtask) {
            subtask.marks[dayIndex] = false;
            this.updateTaskProgress(taskId);
          }
        }
      }
    },

    /**
     * Открывает модальное окно с заданными параметрами.
     * @param {Object} options - { type: 'alert'|'confirm'|'custom', title, message, onConfirm, onCancel }
     */
    showModal(options) {
      this.modal = {
        ...this.modal,
        isOpen: true,
        ...options,
      };
    },

    /** Закрывает модальное окно и сбрасывает его состояние */
    closeModal() {
      this.modal = {
        isOpen: false,
        title: '',
        message: '',
        type: 'alert',
        onConfirm: null,
        onCancel: null,
      };
    },

    /** Дублирует задачи текущего месяца в текущий реальный (без отметок) */
    duplicateToCurrentMonth() {
      this.showModal({
        type: 'confirm',
        title: 'Подтвердите дублирование',
        message: 'Задачи выбранного месяца будут скопированы в текущий (с заменой)',
        onConfirm: async () => {
          const realMonthKey = `${this.realDate.getFullYear()}-${String(this.realDate.getMonth() + 1).padStart(2, '0')}`;
          const currentMonthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;

          if (currentMonthKey === realMonthKey) return;

          const cleanTasks = this.tasks.map(task => ({
            ...task,
            id: Date.now() + Math.random(),
            subtasks: task.subtasks.map(sub => ({
              id: Date.now() + Math.random(),
              marks: Array(this.daysInMonth).fill(null),
            })),
          }));

          this.archive[realMonthKey] = { tasks: cleanTasks };
          localStorage.setItem('habitArchive', JSON.stringify(this.archive));

          this.currentDate = new Date(this.realDate);
          this.tasks = cleanTasks;
          this.adaptMarksToNewMonth();
          this.saveState();
          this.closeModal();
        },
      });
    },

    /** Показывает приветственное сообщение, если пользователь его ещё не видел */
    showWelcomeIfNeeded() {
      if (!this.hasSeenWelcome) {
        this.showModal({
          type: 'alert',
          title: this.$i18n.t('welcome.title'),
          message: this.$i18n.t('welcome.message'),
          onConfirm: () => {
            this.hasSeenWelcome = true;
            localStorage.setItem('hasSeenWelcome', 'true');
            this.closeModal();
          },
        });
      }
    },
  },
});
