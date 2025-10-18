import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import './style.css';
import App from './App.vue';
import en from './locales/en.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import es from './locales/es.json';
import zh from './locales/zh.json';

// Загружаем настройки языка
const savedLang = localStorage.getItem('lang') || 'system';
let systemLang = 'en';
const navLang = navigator.language.toLowerCase();
if (navLang.startsWith('ru')) systemLang = 'ru';
else if (navLang.startsWith('ar')) systemLang = 'ar';
else if (navLang.startsWith('es')) systemLang = 'es';
else if (navLang.startsWith('zh')) systemLang = 'zh';
const activeLang = savedLang === 'system' ? systemLang : savedLang;

// Создаём экземпляр i18n
const i18n = createI18n({
  legacy: false,
  locale: activeLang,
  fallbackLocale: 'en',
  messages: {
    en,
    ru,
    ar,
    es,
    zh,
  },
});

// Создаём приложение
const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(i18n);
app.mount('#app');
