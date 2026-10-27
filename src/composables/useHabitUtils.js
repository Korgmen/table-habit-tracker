import { computed, ref } from 'vue';
import { useHabitStore } from '@/stores/habitStore';
import { monthKey } from '@/utils/archive';
import { resolveLang } from '@/i18n';

/** Подписка на media query: один слушатель на всё приложение */
const mediaRef = query => {
  const list = window.matchMedia(query);
  const value = ref(list.matches);
  list.addEventListener('change', event => {
    value.value = event.matches;
  });
  return value;
};

/** Системная тема */
const prefersDark = mediaRef('(prefers-color-scheme: dark)');

/** Десктопная раскладка (таблица) или телефонная (лента дней) */
const isDesktop = mediaRef('(min-width: 768px)');

export function useHabitUtils() {
  const store = useHabitStore();

  /** День недели (0 – воскресенье) для числа открытого месяца */
  const weekdayOf = day => new Date(store.currentYear, store.currentMonth, day).getDay();

  /** День недели, с которого начинается неделя (0 – воскресенье, 1 – понедельник) */
  const firstWeekday = computed(() => (store.weekStart === 'monday' ? 1 : 0));

  /** Номер дня, с которого начинается неделя: перед ним рисуется разделитель */
  const isWeekStart = day => day > 1 && weekdayOf(day) === firstWeekday.value;

  /** Суббота или воскресенье */
  const isWeekend = day => [0, 6].includes(weekdayOf(day));

  /** Массив дней текущего месяца (1 … daysInMonth) */
  const monthDays = computed(() => Array.from({ length: store.daysInMonth }, (_, i) => i + 1));

  /** Открыт реальный текущий месяц */
  const isCurrentMonth = computed(() => store.currentMonthKey === store.realMonthKey);

  /** Сегодняшнее число в открытом текущем месяце; null для других месяцев */
  const todayDay = computed(() => (isCurrentMonth.value ? store.realDate.getDate() : null));

  /** День ещё не наступил: отмечать нельзя */
  const isFuture = day => day > store.today;

  /** Короткое название дня недели на языке интерфейса; длинные (арабский) сжимаются до буквы */
  const weekdayLabel = day => {
    const date = new Date(store.currentYear, store.currentMonth, day);
    const locale = resolveLang(store.lang);
    const short = date.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '');
    const label =
      short.length <= 3 ? short : date.toLocaleDateString(locale, { weekday: 'narrow' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  /** Подписи дней недели для календаря, начиная с первого дня недели */
  const weekHeaders = computed(() => {
    const locale = resolveLang(store.lang);
    /** 4 января 2026 – воскресенье */
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(2026, 0, 4 + ((i + firstWeekday.value) % 7));
      const label = date.toLocaleDateString(locale, { weekday: 'narrow' });
      return label.charAt(0).toUpperCase() + label.slice(1);
    });
  });

  /** Сколько пустых клеток в календаре перед первым числом */
  const leadingBlanks = computed(() => (weekdayOf(1) - firstWeekday.value + 7) % 7);

  /** Определяет текущую тему (light/dark) на основе настроек пользователя */
  const currentTheme = computed(() => {
    if (store.theme === 'system') {
      return prefersDark.value ? 'dark' : 'light';
    }
    return store.theme;
  });

  /**
   * Определяет, можно ли перейти к следующему месяцу.
   * Доступно только для месяцев не позже текущего реального.
   */
  const canNextMonth = computed(
    () => monthKey(new Date(store.currentYear, store.currentMonth + 1, 1)) <= store.realMonthKey
  );

  /** Название месяца для середины фразы: регистр как принято в языке («апрель», «April») */
  const monthWord = date => date.toLocaleString(resolveLang(store.lang), { month: 'long' });

  /** Открытый, предыдущий и реальный текущий месяц для текстов */
  const currentMonthLabel = computed(() => monthWord(store.currentDate));
  const prevMonthLabel = computed(() =>
    monthWord(new Date(store.currentYear, store.currentMonth - 1, 1))
  );
  const realMonthLabel = computed(() => monthWord(store.realDate));

  return {
    isDesktop,
    weekdayOf,
    isWeekStart,
    isWeekend,
    monthDays,
    isCurrentMonth,
    todayDay,
    isFuture,
    weekdayLabel,
    weekHeaders,
    leadingBlanks,
    currentTheme,
    canNextMonth,
    currentMonthLabel,
    prevMonthLabel,
    realMonthLabel,
  };
}
