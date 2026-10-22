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

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, ru, ar, es, zh },
});

/** Переключает словарь, lang и направление текста документа под настройку языка */
export const applyLang = lang => {
  const code = resolveLang(lang);
  i18n.global.locale.value = code;
  document.documentElement.lang = code;
  document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
};

applyLang(localStorage.getItem('lang'));
