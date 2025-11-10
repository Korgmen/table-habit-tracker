import { computed } from 'vue';
import { useHabitStore } from '../stores/habitStore';

export function useHabitUtils() {
  const store = useHabitStore();

  /** День недели, считающийся концом недели (0 – воскресенье, 6 – суббота) */
  const weekEndDay = computed(() => (store.weekStart === 'monday' ? 0 : 6));

  /** Показывать ли вертикальный разделитель конца недели */
  const isEndOfWeek = (day, isLastDay = false) => {
    if (!store.showWeekSeparators) return false;
    const date = new Date(store.currentYear, store.currentMonth, day);
    const isWeekEnd = date.getDay() === weekEndDay.value;
    return isWeekEnd && !isLastDay;
  };

  /** Массив дней текущего месяца (1 … daysInMonth) */
  const monthDays = computed(() => Array.from({ length: store.daysInMonth }, (_, i) => i + 1));

  /** Определяет текущую тему (light/dark) на основе настроек пользователя */
  const currentTheme = computed(() => {
    if (store.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return store.theme;
  });

  /**
   * Определяет, можно ли перейти к следующему месяцу.
   * Доступно только для месяцев не позже текущего реального.
   */
  const canNextMonth = computed(() => {
    const newDate = new Date(store.currentDate);
    newDate.setMonth(store.currentMonth + 1);
    const newMonthKey = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    const realMonthKey = `${store.realDate.getFullYear()}-${String(store.realDate.getMonth() + 1).padStart(2, '0')}`;
    return newMonthKey <= realMonthKey;
  });

  return {
    weekEndDay,
    isEndOfWeek,
    monthDays,
    currentTheme,
    canNextMonth,
  };
}
