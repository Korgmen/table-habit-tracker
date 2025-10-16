import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import './style.css';
import App from './App.vue';
import messages from './locales/index.json';

// Загружаем настройки языка
const savedLang = localStorage.getItem('lang') || 'system';
const systemLang = navigator.language.startsWith('ru') ? 'ru' : 'en';
const activeLang = savedLang === 'system' ? systemLang : savedLang;

// Создаём экземпляр i18n
const i18n = createI18n({
  legacy: false,
  locale: activeLang,
  fallbackLocale: 'en',
  messages,
});

// Создаём приложение
const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(i18n);
app.mount('#app');
