import { describe, it, expect, afterEach } from 'vitest';
import { i18n, intlLocale, localeWeekStart } from '@/i18n';

const { t, locale } = i18n.global;

afterEach(() => {
  locale.value = 'en';
});

const days = (lang, count) => {
  locale.value = lang;
  return t('stats.days', { count }, count);
};

describe('формы множественного числа', () => {
  it('русский: один, несколько, много', () => {
    expect([1, 2, 5, 11, 21, 22, 25].map(count => days('ru', count))).toEqual([
      '1 день',
      '2 дня',
      '5 дней',
      '11 дней',
      '21 день',
      '22 дня',
      '25 дней',
    ]);
  });

  it('арабский: шесть форм', () => {
    expect([0, 1, 2, 3, 11, 100].map(count => days('ar', count))).toEqual([
      '0 يوم',
      'يوم واحد',
      'يومان',
      '3 أيام',
      '11 يومًا',
      '100 يوم',
    ]);
  });

  it('английский и испанский: один и остальные, китайский: одна форма', () => {
    expect([1, 0, 7].map(count => days('en', count))).toEqual(['1 day', '0 days', '7 days']);
    expect([1, 2].map(count => days('es', count))).toEqual(['1 día', '2 días']);
    expect([1, 2].map(count => days('zh', count))).toEqual(['1 天', '2 天']);
  });
});

describe('локаль чисел и начало недели', () => {
  it('в арабском даты с латинскими цифрами', () => {
    expect(intlLocale('ar')).toBe('ar-u-nu-latn');
    expect(new Date(2026, 9, 12).toLocaleDateString(intlLocale('ar'), { day: 'numeric' })).toBe(
      '12'
    );
    expect(intlLocale('ru')).toBe('ru');
  });

  it('неделя по языку интерфейса, если язык браузера другой', () => {
    /** jsdom: язык браузера en-US */
    expect(localeWeekStart('en')).toBe('sunday');
    expect(localeWeekStart('ru')).toBe('monday');
    expect(localeWeekStart('es')).toBe('monday');
  });
});
