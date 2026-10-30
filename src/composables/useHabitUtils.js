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

/**
 * Десктопная раскладка (таблица) или телефонная (лента дней). Планшет от 768px тоже получает
 * таблицу: при сенсорном экране (pointer: coarse) клетки таблицы крупнее (классы pointer-coarse:).
 */
const isDesktop = mediaRef('(min-width: 768px)');

/** Модификатор горячих клавиш для подписей: ⌘ на Apple, Ctrl на остальных */
const modKey = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

/**
 * Цвет клетки тепловой карты по доле выполненного 0–1: от бледного к цвету отметки «выполнено».
 * null – учитывать нечего (нет привычек или всё в пропусках).
 */
const heatColor = ratio =>
  ratio === null
    ? 'var(--soft)'
    : `color-mix(in oklch, var(--ink) ${Math.round(12 + ratio * 88)}%, var(--soft))`;

/** Оценка звёздами 0–5: «★★★☆☆» */
const starsText = count => '★'.repeat(count) + '☆'.repeat(5 - count);

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

  /** Короткое название дня недели по номеру (0 – воскресенье) */
  const weekdayName = weekday => {
    /** 4 января 2026 – воскресенье */
    const label = new Date(2026, 0, 4 + weekday).toLocaleDateString(resolveLang(store.lang), {
      weekday: 'short',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  /** Номера дней недели (0 – воскресенье) по порядку, начиная с первого дня недели */
  const weekOrder = computed(() =>
    Array.from({ length: 7 }, (_, i) => (i + firstWeekday.value) % 7)
  );

  /** Стиль с цветом привычки для классов вида bg-(--habit) */
  const habitColorStyle = task =>
    task?.color ? { '--habit': `var(--habit-${task.color})` } : undefined;

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

  /** Месяц с годом по ключу 'YYYY-MM': «октябрь 2026 г.» */
  const monthKeyLabel = key => {
    const [year, month] = key.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString(resolveLang(store.lang), {
      month: 'long',
      year: 'numeric',
    });
  };

  /** Короткое название месяца по ключу 'YYYY-MM' для подписей графиков: «окт.» */
  const monthShortLabel = key => {
    const [year, month] = key.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString(resolveLang(store.lang), {
      month: 'short',
    });
  };

  /** Дата по ключу месяца и числу: «12 окт.» */
  const dayDateLabel = (key, day) => {
    const [year, month] = key.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(resolveLang(store.lang), {
      day: 'numeric',
      month: 'short',
    });
  };

  /** Открытый, предыдущий и реальный текущий месяц для текстов */
  const currentMonthLabel = computed(() => monthWord(store.currentDate));
  const prevMonthLabel = computed(() =>
    monthWord(new Date(store.currentYear, store.currentMonth - 1, 1))
  );
  const realMonthLabel = computed(() => monthWord(store.realDate));

  return {
    isDesktop,
    modKey,
    weekdayOf,
    isWeekStart,
    isWeekend,
    monthDays,
    isCurrentMonth,
    todayDay,
    isFuture,
    weekdayLabel,
    weekHeaders,
    weekdayName,
    weekOrder,
    habitColorStyle,
    leadingBlanks,
    currentTheme,
    canNextMonth,
    currentMonthLabel,
    prevMonthLabel,
    realMonthLabel,
    monthKeyLabel,
    monthShortLabel,
    dayDateLabel,
    heatColor,
    starsText,
  };
}
