# Table — Habit Tracker

[![GitHub stars](https://img.shields.io/github/stars/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/stargazers)
[![GitHub last commit](https://img.shields.io/github/last-commit/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/issues)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/korgmen/table-habit-tracker/blob/main/LICENSE.txt)

[Русский](./README.md) | [العربية](./README.ar.md) | [Español](./README.es.md) | [中文](./README.zh.md)

**Table** is a multifunctional habit tracker that helps you track daily task completion, build sustainable habits, and analyze progress. The app works in the browser as well as a PWA (Progressive Web App), supports offline mode, Google synchronization, and printing tables for manual filling.

Modern stack: Vue 3, Vite, Pinia, TailwindCSS, vue-i18n, vue-draggable-next, Lucide icons, ESLint, Prettier, Firebase (for authentication and synchronization), Vite PWA.

The app stores data locally in the browser (localStorage), with monthly archiving. Maximum 20 tasks and 8 subtasks per task for optimal performance.

![App screenshot](https://lebedevcode.ru/table-screenshot-en.png)

---

## Multilingual Support
- The entire interface is translated (see `src/locales/`).
- Supported languages: English, Russian, Arabic, Spanish, Chinese.
- Language can be switched in settings or use system default.

## Features
- **Tasks and subtasks**: Add, edit, delete tasks and subtasks (up to 8 subtasks per task). Drag&Drop to reorder tasks (vue-draggable-next).
- **Daily marks**: Completed (filled circle), not completed (empty), skip (cross — day not counted in stats). Mobile double-tap support for quick switching (single tap — complete/erase, double — skip). On desktop: Left click — complete/erase, right click — skip.
- **Modes**: 
  - Eraser mode for quick mark removal.
  - Delete mode for tasks.
- **Month navigation**: Switch months, view past archives (data stored monthly in localStorage). Automatic archiving on month change.
- **Statistics**: Completion percentage per task, overall average, 5-point grade. Two calculation modes: full month or passed days only.
- **Data export/import**: JSON export, file import. Full archive compatibility.
- **Theme switching**: Light, dark, or system (auto based on OS settings).
- **Language switching**: English, Russian, Arabic, Spanish, Chinese, or system.
- **Display settings**: Week separators (vertical lines), week start (Monday/Sunday).
- **Keyboard shortcuts**: Quick control (Escape — reset, E — erase, D — delete, N — new task, arrows — month switch, S — settings).
- **Printing**: Clean table print (no buttons/UI) for paper manual marking.
- **PWA support**: Install as mobile app, offline work, auto-update notification.
- **Synchronization**: Google login for cloud sync (Firebase). Auto load/save on login.
- **Modals**: Welcome explanation on first launch, duplication confirmations, PWA update prompt.
- **Task duplication**: Copy tasks from previous month to current.
- **Responsive design**: Full support for mobile devices and tablets.
- **Limits and optimizations**: Max 20 tasks for performance; auto-save settings and data across sessions.

## Project Structure
- `src/App.vue` — main app component (table, header, modals).
- `src/main.js` — Vue, Pinia, i18n, Firebase initialization.
- `src/stores/habitStore.js` — Pinia store: task/progress/theme/language/archive/export-import/week settings/auth/sync management.
- `src/locales/` — localization JSON files per language.
- `src/components/` — components: Header, TableHeader, TaskRow, Modal, SettingsModal, Controls, OverallStats, etc.
- `src/composables/` — hooks: useHabitUtils (week/theme utils), useModals (modals).
- `src/style.css` — global styles, TailwindCSS, custom fonts.
- `src/firebase.js` — Firebase config for auth and Firestore.
- Configs: `vite.config.js` (Vite, PWA, Tailwind), `eslint.config.js` (ESLint), `.prettierrc` (Prettier), `package.json` (dependencies/scripts).

## Quick Start
1. Clone the repository:
   ```sh
   git clone https://github.com/korgmen/table-habit-tracker.git
   cd table-habit-tracker
   ```
2. Install dependencies:
   ```sh
   pnpm install
   ```
3. Run in development mode:
   ```sh
   pnpm run dev
   ```
4. Build for production:
   ```sh
   pnpm run build
   ```
5. Code checks:
   ```sh
   pnpm run lint        # ESLint linting
   pnpm run format      # Prettier formatting
   ```
6. Preview build:
   ```sh
   pnpm run preview
   ```

For PWA: Open build in browser and install as app. Offline mode via Service Worker.

## Main Dependencies
- [Vue 3](https://vuejs.org/) — framework.
- [Vite](https://vitejs.dev/) — build tool.
- [Pinia](https://pinia.vuejs.org/) — state management.
- [TailwindCSS](https://tailwindcss.com/) — styles.
- [vue-i18n](https://vue-i18n.intlify.dev/) — localization.
- [vue-draggable-next](https://github.com/anish2690/vue-draggable-next) — drag&drop.
- [lucide-vue-next](https://lucide.dev/) — icons.
- [Firebase](https://firebase.google.com/) — authentication and cloud storage.
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — PWA features.
- Dev: ESLint, Prettier, eslint-plugin-vue, eslint-plugin-tailwindcss.

Full list in `package.json`.

## Architecture & Logic
- **Data storage**: localStorage for tasks, marks, archive (key: `habitArchive`). Monthly format `{ "YYYY-MM": { tasks: [...] } }`. Settings stored separately (theme, language, week).
- **Pinia store** (`habitStore.js`): Central management of tasks, subtasks, marks, stats, theme, language, export/import, weeks, modals, auth, Firestore sync.
- **Localization**: vue-i18n with JSON files in `src/locales/`. Auto system language detection.
- **Themes**: System, light/dark. Applied at root.
- **PWA**: Manifest in `vite.config.js` (icons, theme_color). Auto-update modal.
- **Sync**: Firebase Auth (Google) and Firestore. Data in `/users/{uid}`. Auto load on login.
- **Modals**: Universal component for confirms, alerts, custom content (welcome, update).
- **Optimizations**: Lazy loading, responsive design, touch support, accessibility (ARIA, focus trap).

## Keyboard Shortcuts
- Escape — reset modes, close menu/settings.
- E — toggle eraser mode.
- D — toggle delete mode.
- N — add new task.
- Left/right arrow — switch month.
- S — open/close settings.

## Contribution
Contributions welcome! 
- Fork repo and create feature/fix branch.
- Follow code style (Prettier, ESLint).
- Use existing components and store.
- For new languages — add translations to `src/locales/` (JSON).
- Before PR: `pnpm run lint && pnpm run format`.
- Describe changes in PR, add tests if needed.

Questions? Open an issue.

## License
Apache-2.0 – [LICENSE.txt](./LICENSE.txt) | [NOTICE.txt](./NOTICE.txt)