# Habit Tracker — Vue 3 + Vite

Многофункциональный трекер привычек с поддержкой задач, подзадач, отметок по дням, экспорта/импорта, смены темы и языка. Современный стек: Vue 3, Vite, Pinia, TailwindCSS, i18n, ESLint, Prettier.

## Возможности
- Добавление, редактирование, удаление задач и подзадач
- Отметки выполнения по дням месяца
- Переключение месяца, просмотр архива
- Экспорт и импорт данных (JSON)
- Смена темы (светлая/тёмная/системная)
- Смена языка (русский/английский/системный)
- Drag&Drop задач (vue-draggable-next)
- Адаптивный дизайн, поддержка печати

## Структура проекта

- `src/App.vue` — основной компонент приложения
- `src/main.js` — инициализация Vue, Pinia, i18n
- `src/stores/habitStore.js` — Pinia store: логика задач, прогресса, темы, языка, экспорта/импорта
- `src/locales/index.json` — локализации (ru, en)
- `src/components/` — дополнительные компоненты (если есть)
- `src/style.css` — TailwindCSS и глобальные стили
- `public/` — статические файлы
- Конфиги: `vite.config.js`, `eslint.config.js`, `.prettierrc`

## Быстрый старт

```sh
pnpm install         # Установка зависимостей
pnpm run dev         # Запуск для разработки
pnpm run build       # Сборка для продакшн
pnpm run lint        # Линтинг кода
pnpm run format      # Форматирование кода
```

## Основные зависимости
- [Vue 3](https://vuejs.org/) — фреймворк
- [Vite](https://vitejs.dev/) — сборщик
- [Pinia](https://pinia.vuejs.org/) — хранилище состояния
- [TailwindCSS](https://tailwindcss.com/) — стили
- [vue-i18n](https://vue-i18n.intlify.dev/) — локализация
- [vue-draggable-next](https://github.com/anish2690/vue-draggable-next) — drag&drop
- [lucide-vue-next](https://lucide.dev/) — иконки

## Архитектура и логика
- Все данные задач и отметок хранятся в localStorage (архив по месяцам)
- Pinia store (`habitStore.js`) управляет задачами, подзадачами, прогрессом, темой, языком, экспортом/импортом
- Локализация через vue-i18n, переводы в `src/locales/index.json`
- Темы и язык сохраняются между сессиями
- Drag&Drop реализован через vue-draggable-next

## Вклад
- Соблюдайте стиль кода (Prettier, ESLint)
- Используйте существующие компоненты и store
- Для новых языков — добавьте переводы в `src/locales/index.json`
- Перед пулл-реквестом: `pnpm run lint && pnpm run format`

## Лицензия
MIT