# Table — Habit Tracker — Vue 3 + Vite (English)

A multifunctional habit tracker with support for tasks, subtasks, daily marks, data export/import, theme and language switching. Modern stack: Vue 3, Vite, Pinia, TailwindCSS, i18n, ESLint, Prettier.

---

## Multilingual Support
- Supported languages: Russian, English, Arabic, Spanish, Chinese
- All interface texts are localized (see `src/locales/index.json`)
- You can switch the app language in settings
- To add new languages, extend `src/locales/index.json` and update the language selector

## Features

- Add, edit, delete tasks and subtasks
- Daily marks for each task/subtask
- Month switching, archive view
- Data export and import (JSON)
- Theme switching (light/dark/system)
- Language switching (Russian/English/Arabic/Spanish/Chinese/System)
- Drag&Drop for tasks (vue-draggable-next)
- Responsive design, print support
- **Week display settings:** week separators, choose week start (Monday/Sunday)
- **Keyboard shortcuts** for quick control
- All settings are saved between sessions

## Project Structure

- `src/App.vue` — main application component
- `src/main.js` — Vue, Pinia, i18n initialization
- `src/stores/habitStore.js` — Pinia store: logic for tasks, progress, theme, language,
  export/import, week settings
- `src/locales/index.json` — localizations (ru, en)
- `src/components/` — additional components (if any)
- `src/style.css` — TailwindCSS and global styles
- `public/` — static files
- Configs: `vite.config.js`, `eslint.config.js`, `.prettierrc`

## Quick Start

```sh
pnpm install         # Install dependencies
pnpm run dev         # Start development server
pnpm run build       # Build for production
pnpm run lint        # Lint code
pnpm run format      # Format code
```

## Main dependencies

- [Vue 3](https://vuejs.org/) — framework
- [Vite](https://vitejs.dev/) — build tool
- [Pinia](https://pinia.vuejs.org/) — state management
- [TailwindCSS](https://tailwindcss.com/) — styles
- [vue-i18n](https://vue-i18n.intlify.dev/) — localization
- [vue-draggable-next](https://github.com/anish2690/vue-draggable-next) — drag&drop
- [lucide-vue-next](https://lucide.dev/) — icons

## Architecture & Logic

- All task and mark data is stored in localStorage (archive by month)
- Pinia store (`habitStore.js`) manages tasks, subtasks, progress, theme, language, export/import,
  week settings
- Localization via vue-i18n, translations in `src/locales/index.json`
- Theme, language, week settings are persistent
- Drag&Drop implemented via vue-draggable-next

## Keyboard Shortcuts

- Escape — reset modes, close menu/settings
- E — toggle eraser mode
- D — toggle delete mode
- N — add new task
- Arrow left/right — switch month
- S — open/close settings

## Contribution

- Follow code style (Prettier, ESLint)
- Use existing components and store
- For new languages — add translations to `src/locales/index.json`
- Before pull request: `pnpm run lint && pnpm run format`

## License

MIT
