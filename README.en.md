# Table — Habit Tracker

[![GitHub stars](https://img.shields.io/github/stars/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/stargazers)
[![GitHub last commit](https://img.shields.io/github/last-commit/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/issues)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/korgmen/table-habit-tracker/blob/main/LICENSE.txt)

[Русский](./README.md) | **English** | [Español](./README.es.md) | [中文](./README.zh.md) | [العربية](./README.ar.md)

**Table** is a habit tracker built as a "habit × day of the month" table. Each day you mark what you did, and the app calculates the percentage, streaks and the month summary and keeps an archive by month. It runs in the browser and as an offline PWA, and syncs data across devices through Google sign-in. The month sheet can be printed, filled in by hand, and its marks transferred into the app from a photo.

Stack: Vue 3, Vite, Pinia, Tailwind CSS 4, vue-i18n, Firebase (Auth and Firestore), vite-plugin-pwa.

![App screenshot](https://lebedevcode.ru/table-screenshot.png)

---

## Languages

- The interface is available in Russian, English, Spanish, Chinese and Arabic (with a right-to-left layout).
- The language is chosen in the settings; by default the system language is used.
- Dictionaries are in `src/locales/`, the reference one is `en.json`.

## Features

### Marks

- A cell has three states: done, not done (empty) and skip. A skipped day is not counted in the percentage.
- Past days and today can be marked. Future months cannot be opened.
- Desktop: the month table. A click on a cell sets "done", a second click or a right click sets a skip, a third click clears the mark. A click on the date in the header marks the day for all habits, a right click on the date sets a skip. Alt+click opens the note for the day.
- Phone (screen narrower than 768 px): a strip of days and the marks for the selected day. A tap on a circle cycles done → skip → empty, a long press sets a skip. A swipe over the list changes the day, a swipe over the month name changes the month. Quick actions: go to today, to yesterday or to unmarked days, mark everything for the day, clear done marks.

### Habits

- Up to 20 habits per month and up to 8 marks per day for each (for example, sets or glasses of water).
- A name of up to 60 characters, an emoji (catalog search and suggestions based on the habit name), one of 8 colors.
- Schedule: every day, on selected weekdays, or N times a week (up to 6). Days outside the schedule are marked as skipped. Once the weekly goal is reached, the remaining empty days of that week are marked as skipped. For partial weeks at the edges of the month the goal is proportionally smaller.
- Pause: the habit is excluded from the average percentage and can still be marked as usual.
- Notes for days, up to 500 characters.
- The order is changed by dragging or with the "Up" and "Down" buttons.
- Habit card: marks for the month, current and best streak, average over all months and for each month.

### Progress and statistics

- Completion percentage for each habit and the average percentage for the month. It is calculated from all days of the month or only from the past days.
- Month summary next to the average percentage: percentage only, 0–5 stars, A–F letters, a 2–5 grade, or nothing. By default the 2–5 grade is shown for Russian and the percentage for other languages.
- Streaks are counted in days, and in weeks for habits with an "N times a week" goal.
- Statistics window by year: yearly average, number of done marks, best streak, month and year heatmaps, average by month, habits table for the year.

### Months and archive

- Each month is stored separately. Past months are opened with the arrows, their marks can be corrected, and statistics are recalculated.
- A new month, when first opened, receives the habits of the last filled month with clean marks.
- Habits are moved from an archived month to the current one manually: the needed habits are selected and either added to the current ones or replace them.
- Search: a filter for the habits of the open month and a search by names, emoji and notes across all months.

### Undo and redo

- The last 50 changes can be undone and redone: marks, habit edits and order, deletion, moving, import, notes, pause, loading from the cloud.
- The undo history is kept until the page is reloaded.

### Sheet and photo

- Printing an A4 month sheet with ArUco corner markers and a QR code.
- A photo of the filled sheet is recognized in the browser. On the review screen, differences from the current data are outlined with a solid frame, uncertain marks with a dashed one, and a tap changes a mark. After review, the marks are transferred to the table.
- The sheet is tied to the month and the habits it was printed for. The app warns about a sheet for another month and about habits deleted after printing.

### Data

- Data is stored in the browser (`localStorage`), and the app works offline.
- JSON export and import (file up to 2 MB). Before import a summary and a choice are shown: merge with the current data (for months present both here and in the file, a version is chosen) or replace everything, settings included.
- Before import a backup of the current data is saved. It can be restored or downloaded, and the import itself can be undone.
- CSV export of the open month or of all months.

### Sync

- Google sign-in; data is stored in Firestore by month.
- Offline, changes accumulate on the device and are sent once a connection appears. The sync state is visible in the interface.
- If a month differs on the device and in the cloud, a version is chosen for each month. The choice can be postponed, and the other months keep syncing.
- On sign-out, local data is removed from the device. If changes have not reached the cloud, the app warns and offers to save them to a file.

### Settings and interface

- Theme: light, dark or system.
- Week start: Monday, Sunday, or by language and region. Week separators in the table are turned on separately.
- The table and the toggle groups can be operated from the keyboard, and cells have labels for screen readers.
- PWA: installation on the device, offline work, a new version notice with an update button.
- A welcome window explaining the marks, which can be opened again from the settings ("How it works").

## Keyboard shortcuts

The list is also available in the app settings.

| Key                      | Action                                     |
| ------------------------ | ------------------------------------------ |
| N                        | New habit                                  |
| S                        | Settings                                   |
| ← / →                    | Previous / next month (reversed in Arabic) |
| T                        | Go to the current month                    |
| /                        | Habit filter                               |
| ↑ ↓ ← →, Home, End       | Move around the table                      |
| X                        | Skip in a table cell                       |
| Alt+Enter                | Note for the day in a table cell           |
| Ctrl/⌘+Z                 | Undo                                       |
| Ctrl/⌘+Shift+Z, Ctrl/⌘+Y | Redo                                       |
| Esc                      | Close the window                           |

## Quick start

Node.js and pnpm are required.

```sh
git clone https://github.com/korgmen/table-habit-tracker.git
cd table-habit-tracker
pnpm install
pnpm dev
```

Commands:

- `pnpm dev` — Vite dev server.
- `pnpm build` — build into `dist/`.
- `pnpm preview` — local preview of the build.
- `pnpm lint` — ESLint check, `pnpm lint:fix` — with fixes.
- `pnpm format` — Prettier formatting.
- `pnpm test` — Vitest tests, `npx vitest run` — a single run.

The Service Worker and PWA installation work in the build: `pnpm build`, then `pnpm preview`.

## Project structure

- `src/App.vue` — root component: the table on desktop or the strip of days on a phone, global shortcuts, sheet printing, windows and the toast.
- `src/main.js` — starts Vue, Pinia, vue-i18n and authentication.
- `src/i18n.js` — vue-i18n setup, language selection and plural rules.
- `src/stores/habitStore.js` — state and logic: habits, marks, progress, months, settings, undo, import and export, sign-in and sync.
- `src/stores/modalStore.js` — the window stack, the queue of windows the app opens by itself, and the toast.
- `src/utils/` — pure functions: `archive.js` (archive, data validation and repair, moving habits), `habitMath.js` (progress, streaks, schedule and goals), `stats.js` (statistics), `cloudSync.js` (per-month sync decisions), `csv.js` (CSV), `emojiSearch.js` (emoji search), `sheetLayout.js` (sheet geometry and QR content), `sheetScan.js` (sheet photo recognition).
- `src/composables/` — `useHabitUtils.js` (days of the month, theme, weeks), `useModals.js` (window scenarios and closing with the "back" button), `useGridNavigation.js` (keyboard in the table), `useGestures.js` (swipes and long press), `useSearch.js` (search).
- `src/directives/radioGroup.js` — keyboard in toggle groups.
- `src/components/` — interface: table (`HabitGrid`, `HabitRow`, `MarkCircle`), phone (`MobileView`), windows (`HabitSheet`, `SettingsSheet`, `StatsSheet`, `ImportSheet`, `ConflictSheet`, `NoteSheet`, `SearchSheet` and others), sheet and photo (`PaperSheet`, `PhotoImport`).
- `src/locales/` — interface dictionaries.
- `src/firebase.js` — public Firebase web config.
- `firestore.rules` — Firestore rules: a user reads and writes only their own documents.
- Configs: `vite.config.js` (Vite, PWA, Tailwind, Vitest, emoji data), `eslint.config.js`, `.prettierrc`.
- `*.test.js` tests sit next to the modules.

## Main dependencies

- [Vue 3](https://vuejs.org/) — framework.
- [Vite](https://vite.dev/) — bundler.
- [Pinia](https://pinia.vuejs.org/) — state.
- [Tailwind CSS](https://tailwindcss.com/) — styles.
- [vue-i18n](https://vue-i18n.intlify.dev/) — localization.
- [vue-draggable-next](https://github.com/anish2690/vue-draggable-next) — drag and drop.
- [lucide-vue-next](https://lucide.dev/) — icons.
- [Firebase](https://firebase.google.com/) — sign-in and cloud storage.
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — PWA.
- [js-aruco2](https://www.npmjs.com/package/js-aruco2) and [jsQR](https://www.npmjs.com/package/jsqr) — sheet recognition, [uqr](https://www.npmjs.com/package/uqr) — QR code on the sheet.
- [emojibase-data](https://www.npmjs.com/package/emojibase-data) — emoji catalog, [Golos Text](https://www.npmjs.com/package/@fontsource-variable/golos-text) — font.
- Development: ESLint, eslint-plugin-vue, Prettier, prettier-plugin-tailwindcss, Vitest, jsdom.

The full list is in `package.json`.

## Architecture and data

- Archive: `localStorage.habitArchive` = `{ "YYYY-MM": { tasks: [...] } }`. Settings are stored as separate keys (`theme`, `lang`, `weekStart`, `showWeekSeparators`, `calculationMode`, `summaryStyle`), the pre-import backup in `habitArchiveBackup`, sync metadata in `habitSyncMeta`.
- Habit: `{ id, title, progress, subtasks: [{ id, marks }], color?, emoji?, schedule?, goal?, paused?, notes? }`. `marks` has one element per day of the month: `true` — done, `null` — not done, `false` — skip.
- Firestore: `users/{uid}` holds the settings and service fields, months are in `users/{uid}/months/{YYYY-MM}`. The local Firestore cache is stored in IndexedDB.
- Windows: the stack is in `modalStore`, windows are rendered by `ModalEntry.vue`, and the "back" button closes the top window.
- The sheet layout in `src/utils/sheetLayout.js` is shared by printing and recognition. `js-aruco2` and `jsqr` are loaded on the first recognition.

## Contribution

- Fork the repository and create a branch for your change.
- The code is JavaScript, the style is ESLint and Prettier.
- New interface texts are added to all 5 dictionaries in `src/locales/`.
- Before a pull request: `pnpm lint`, `npx vitest run`, `pnpm build`.
- Questions and bugs go to [issues](https://github.com/korgmen/table-habit-tracker/issues).

## License

Apache-2.0 — [LICENSE.txt](./LICENSE.txt), [NOTICE.txt](./NOTICE.txt).
