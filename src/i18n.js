import { createI18n } from 'vue-i18n';
import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import ar from '@/locales/ar.json';
import es from '@/locales/es.json';
import zh from '@/locales/zh.json';

/** Языки, для которых есть словари в src/locales */
export const SUPPORTED_LANGS = ['en', 'ru', 'ar', 'es', 'zh'];

/**
 * Возвращает код активного языка интерфейса.
 * 'system' раскрывается по navigator.language, неизвестный язык даёт английский.
 */
export const resolveLang = lang => {
  if (SUPPORTED_LANGS.includes(lang)) return lang;
  const navLang = navigator.language.toLowerCase();
  return SUPPORTED_LANGS.find(code => navLang.startsWith(code)) || 'en';
};

/**
 * Локаль для дат и чисел (toLocaleString, Intl): язык интерфейса, в арабском – с латинскими
 * цифрами, как числа дней, проценты и счётчики в интерфейсе.
 */
export const intlLocale = lang => {
  const code = resolveLang(lang);
  return code === 'ar' ? 'ar-u-nu-latn' : code;
};

/**
 * Регионы, где неделя начинается не с понедельника (с воскресенья или субботы): запасной
 * вариант для браузеров без Intl.Locale weekInfo. Суббота в приложении сводится к воскресенью.
 */
const SUNDAY_REGIONS = new Set(
  'US CA MX BR JP KR TW HK IL IN PH ZA SA AE EG IQ JO KW QA OM BH DZ LY SY SD YE'.split(' ')
);

/**
 * День начала недели по локали: регион берётся из языка браузера, если он совпадает с языком
 * интерфейса, иначе из языка интерфейса («en» – США, «ru» – Россия).
 * @returns {'monday'|'sunday'}
 */
export const localeWeekStart = lang => {
  const code = resolveLang(lang);
  const navLang = navigator.language || code;
  const tag = navLang.toLowerCase().startsWith(code) ? navLang : code;
  try {
    const locale = new Intl.Locale(tag);
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    if (info?.firstDay) return info.firstDay === 1 ? 'monday' : 'sunday';
    return SUNDAY_REGIONS.has(locale.maximize().region) ? 'sunday' : 'monday';
  } catch {
    return 'monday';
  }
};

/**
 * Формы множественного числа в словарях через « | » в порядке категорий CLDR: английский и
 * испанский – one | other, русский – one | few | many («1 день | 2 дня | 5 дней»), арабский –
 * zero | one | two | few | many | other, у китайского одна форма. Число передаётся третьим
 * аргументом: t(key, { count }, count).
 */
const PLURAL_FORMS = {
  en: ['one', 'other'],
  es: ['one', 'other'],
  ru: ['one', 'few', 'many'],
  ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
  zh: ['other'],
};

/** Правило vue-i18n: номер формы по Intl.PluralRules; неизвестная категория – последняя форма */
const pluralRule = lang => {
  const rules = new Intl.PluralRules(lang);
  const forms = PLURAL_FORMS[lang];
  return (choice, choicesLength) => {
    const index = forms.indexOf(rules.select(Math.abs(choice)));
    return Math.min(index < 0 ? forms.length - 1 : index, choicesLength - 1);
  };
};

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, ru, ar, es, zh },
  pluralRules: Object.fromEntries(SUPPORTED_LANGS.map(lang => [lang, pluralRule(lang)])),
});

/** Переключает словарь, lang и направление текста документа под настройку языка */
export const applyLang = lang => {
  const code = resolveLang(lang);
  i18n.global.locale.value = code;
  document.documentElement.lang = code;
  document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
  document.title = i18n.global.t('app.name');
};

applyLang(localStorage.getItem('lang'));
