import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource-variable/golos-text';
import '@/style.css';
import App from '@/App.vue';
import { useHabitStore } from '@/stores/habitStore';
import { i18n } from '@/i18n';
import { radioGroup } from '@/directives/radioGroup';

/** Инициализирует приложение Vue */
const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(i18n);
app.directive('radio-group', radioGroup);

/** Инициализация store и авторизации */
const store = useHabitStore();
store.initAuth();

app.mount('#app');
