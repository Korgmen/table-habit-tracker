import { defineStore } from 'pinia';

export const useHabitStore = defineStore('habit', {
  state: () => {
    const realDate = new Date();
    const savedArchive = localStorage.getItem('habitArchive');
    const archive = savedArchive ? JSON.parse(savedArchive) : {};
    const currentMonthKey = `${realDate.getFullYear()}-${String(realDate.getMonth() + 1).padStart(2, '0')}`;
    const savedTheme = localStorage.getItem('theme') || 'system';
    const savedLang = localStorage.getItem('lang') || 'system';
    const savedWeekStart = localStorage.getItem('weekStart') || 'monday';
    const savedShowWeekSeparators = localStorage.getItem('showWeekSeparators') !== 'false'; // По умолчанию true
    return {
      realDate,
      currentDate: realDate,
      archive,
      tasks: archive[currentMonthKey]?.tasks || [],
      editingTaskId: null,
      activeMode: null,
      theme: savedTheme,
      lang: savedLang,
      weekStart: savedWeekStart,
      showWeekSeparators: savedShowWeekSeparators,
    };
  },
  getters: {
    currentMonth: state => state.currentDate.getMonth(),
    currentYear: state => state.currentDate.getFullYear(),
    daysInMonth: state => {
      const year = state.currentYear;
      const month = state.currentMonth;
      return new Date(year, month + 1, 0).getDate();
    },
    monthName: state => {
      const lang =
        state.lang === 'system' ? (navigator.language.startsWith('ru') ? 'ru' : 'en') : state.lang;
      const month = new Date(state.currentYear, state.currentMonth).toLocaleString(lang, {
        month: 'long',
      });
      return month.charAt(0).toUpperCase() + month.slice(1);
    },
    today: state => {
      const today = state.realDate.getDate();
      return state.currentMonth === state.realDate.getMonth() &&
        state.currentYear === state.realDate.getFullYear()
        ? today
        : state.daysInMonth;
    },
    overallProgress: state => {
      if (state.tasks.length === 0) return 0.0;
      const totalProgress = state.tasks.reduce(
        (sum, task) => sum + (parseFloat(task.progress) || 0),
        0
      );
      return (totalProgress / state.tasks.length).toFixed(1);
    },
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
    /**
     * Добавляет новую задачу.
     */
    addTask() {
      const id = Date.now();
      this.tasks.push({
        id,
        title: 'Новая задача',
        subtasks: [{ id: Date.now() + 1, marks: Array(this.daysInMonth).fill(null) }],
        progress: 0.0,
      });
      this.saveState();
    },
    /**
     * Добавляет подзадачу к задаче.
     */
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
    /**
     * Начинает редактирование задачи.
     */
    startEditing(taskId) {
      this.editingTaskId = taskId;
    },
    /**
     * Завершает редактирование задачи с экранированием HTML.
     */
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
        task.title = escapeHtml(newTitle.trim()) || 'Новая задача';
        this.editingTaskId = null;
        this.saveState();
      }
    },
    /**
     * Обновляет прогресс задачи.
     */
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
    /**
     * Обновляет отметку подзадачи.
     */
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
    /**
     * Обновляет отметки для всех задач в выбранный день.
     */
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
    /**
     * Удаляет задачу.
     */
    deleteTask(taskId) {
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      this.saveState();
    },
    /**
     * Удаляет последнюю подзадачу.
     */
    deleteLastSubtask(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task && task.subtasks.length > 1) {
        task.subtasks.pop();
        this.updateTaskProgress(taskId);
        this.saveState();
      }
    },
    /**
     * Переключает режим (delete/eraser).
     */
    toggleMode(mode) {
      this.activeMode = this.activeMode === mode ? null : mode;
      this.saveState();
    },
    /**
     * Стирает отметку.
     */
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
    /**
     * Сохраняет состояние в localStorage.
     */
    saveState() {
      const currentMonthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
      this.archive[currentMonthKey] = { tasks: this.tasks };
      localStorage.setItem('habitArchive', JSON.stringify(this.archive));
      localStorage.setItem('theme', this.theme);
      localStorage.setItem('lang', this.lang);
      localStorage.setItem('weekStart', this.weekStart);
      localStorage.setItem('showWeekSeparators', this.showWeekSeparators);
    },
    /**
     * Переход к предыдущему месяцу.
     */
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
    /**
     * Переход к следующему месяцу.
     */
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
    /**
     * Адаптирует отметки к новому месяцу.
     */
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
    /**
     * Экспортирует данные в файл.
     */
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
     * Импортирует данные из файла с валидацией.
     */
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
    /**
     * Валидация структуры архива.
     */
    validateArchive(archive) {
      return (
        typeof archive === 'object' &&
        Object.values(archive).every(month => month.tasks && Array.isArray(month.tasks))
      );
    },
    /**
     * Устанавливает тему.
     */
    setTheme(newTheme) {
      this.theme = newTheme;
      this.saveState();
    },
    setLang(newLang) {
      this.lang = newLang;
      localStorage.setItem('lang', newLang);
    },
    /**
     * Устанавливает начало недели.
     */
    setWeekStart(newWeekStart) {
      this.weekStart = newWeekStart;
      this.saveState();
    },
    /**
     * Устанавливает отображение разделителей недель.
     */
    setShowWeekSeparators(newValue) {
      this.showWeekSeparators = newValue;
      this.saveState();
    },
    /**
     * Обработка долгого нажатия.
     */
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
  },
});
