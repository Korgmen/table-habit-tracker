# Table — 习惯追踪器

[![GitHub stars](https://img.shields.io/github/stars/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/stargazers)
[![GitHub last commit](https://img.shields.io/github/last-commit/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/issues)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/korgmen/table-habit-tracker/blob/main/LICENSE.txt)

[Русский](./README.md) | [English](./README.en.md) | [Español](./README.es.md) | **中文** | [العربية](./README.ar.md)

**Table** 是一款以“习惯 × 月内日期”表格形式呈现的习惯追踪器。每天标记完成情况，应用计算百分比、连续天数和月度总结，并按月保存归档。它可以在浏览器中使用，也可以作为离线 PWA 使用，并通过 Google 登录在设备之间同步数据。月度表单可以打印、手工填写，再通过照片把标记导入应用。

技术栈：Vue 3、Vite、Pinia、Tailwind CSS 4、vue-i18n、Firebase（Auth 和 Firestore）、vite-plugin-pwa。

![应用截图](https://lebedevcode.ru/table-screenshot.png)

---

## 语言

- 界面支持俄语、英语、西班牙语、中文和阿拉伯语（从右到左布局）。
- 语言在设置中选择，默认使用系统语言。
- 词典位于 `src/locales/`，基准词典为 `en.json`。

## 功能

### 标记

- 单元格有三种状态：已完成、未完成（空）和跳过。跳过的日子不计入百分比。
- 可以标记过去的日子和今天。未来的月份无法打开。
- 电脑：月度表格。点击单元格设为“已完成”，第二次点击或右键设为跳过，第三次点击清除标记。点击表头中的日期为所有习惯标记这一天，右键点击日期设为跳过。Alt+点击打开当天的备注。
- 手机（屏幕宽度小于 768 px）：日期栏和所选日期的标记。点按圆圈依次切换 已完成 → 跳过 → 空，长按设为跳过。在列表上滑动切换日期，在月份名称上滑动切换月份。快捷操作：跳到今天、昨天或未标记的日子，标记当天全部完成，清除已完成标记。

### 习惯

- 每月最多 20 个习惯，每个习惯每天最多 8 个标记（例如组数或几杯水）。
- 名称最多 60 个字符，表情符号（在目录中搜索，并根据习惯名称推荐），8 种颜色之一。
- 计划：每天、选定的星期几，或每周 N 次（最多 6 次）。计划之外的日子标记为跳过。达到本周目标后，本周剩余的空白日子标记为跳过。月初和月末的不完整周，目标按比例减少。
- 暂停：该习惯不计入平均百分比，仍可照常标记。
- 每天的备注，最多 500 个字符。
- 通过拖动或“上移”“下移”按钮调整顺序。
- 习惯卡片：本月标记、当前和最佳连续记录、所有月份的平均值以及各月数据。

### 进度与统计

- 每个习惯的完成百分比和本月平均百分比。可以按整月的所有日子计算，也可以只按已过去的日子计算。
- 平均百分比旁的月度总结：仅百分比、0–5 星、A–F 字母、2–5 分或不显示。默认情况下，俄语显示 2–5 分，其他语言显示百分比。
- 连续记录以天计算，设有“每周 N 次”目标的习惯以周计算。
- 按年份的统计窗口：年度平均值、已完成标记数、最佳连续记录、月度和年度热力图、各月平均值、全年习惯表。

### 月份与归档

- 每个月单独保存。用箭头打开过去的月份，可以修改其中的标记，统计会重新计算。
- 新月份首次打开时，会获得最近一个有数据月份的习惯，标记为空。
- 可以手动把归档月份的习惯转入当前月份：选择需要的习惯，添加到当前习惯中或替换当前习惯。
- 搜索：筛选当前打开月份的习惯，并在所有月份中按名称、表情符号和备注搜索。

### 撤销与重做

- 可以撤销和重做最近 50 次更改：标记、习惯的编辑和顺序、删除、转移、导入、备注、暂停、从云端加载。
- 撤销历史保留到页面重新加载为止。

### 表单与照片

- 在横向 A4 纸上打印月度表单，带有 ArUco 角标和二维码：习惯名称在左侧，当月日期在右侧，一张纸最多 20 个习惯。
- 已填写表单的照片在浏览器中识别。在核对界面上，与当前数据不同的标记用实线框标出，不确定的标记用虚线框标出，点按可更改标记。核对后，标记转入表格。
- 表单与打印时的月份和习惯绑定。对于其他月份的表单以及打印后删除的习惯，应用会给出提示。

### 数据

- 数据保存在浏览器中（`localStorage`），应用可离线使用。
- JSON 导出和导入（文件最大 2 MB）。导入前会显示摘要并提供选择：与当前数据合并（对于本地和文件中都有的月份，选择保留哪个版本），或连同设置全部替换。
- 导入前会保存当前数据的备份。备份可以恢复或下载，导入本身也可以撤销。
- 导出当前打开月份或所有月份的 CSV。

### 同步

- 使用 Google 登录，数据按月保存在 Firestore 中。
- 离线时，更改保存在设备上，联网后发送。同步状态显示在界面中。
- 如果某个月份在设备和云端不一致，需要为每个月份选择版本。可以推迟选择，其他月份照常同步。
- 退出登录时，本地数据会从设备上删除。如果更改尚未同步到云端，应用会发出警告并建议保存到文件。

### 设置与界面

- 主题：浅色、深色或跟随系统。
- 每周起始日：周一、周日，或根据语言和地区。表格中的周分隔线单独开启。
- 表格和选项组可以用键盘操作，单元格带有供屏幕阅读器使用的标签。
- PWA：安装到设备、离线使用、新版本提示及更新按钮。
- 欢迎窗口介绍标记方式，可在设置中再次打开（“使用说明”）。

## 快捷键

应用设置中也有此列表。

| 按键                     | 操作                                  |
| ------------------------ | ------------------------------------- |
| N                        | 新习惯                                |
| S                        | 设置                                  |
| ← / →                    | 上个月 / 下个月（阿拉伯语中方向相反） |
| T                        | 回到当前月份                          |
| /                        | 筛选习惯                              |
| ↑ ↓ ← →, Home, End       | 在表格中移动                          |
| X                        | 在表格单元格中设为跳过                |
| Alt+Enter                | 在表格单元格中打开当天备注            |
| Ctrl/⌘+Z                 | 撤销                                  |
| Ctrl/⌘+Shift+Z, Ctrl/⌘+Y | 重做                                  |
| Esc                      | 关闭窗口                              |

## 快速开始

需要 Node.js 和 pnpm。

```sh
git clone https://github.com/korgmen/table-habit-tracker.git
cd table-habit-tracker
pnpm install
pnpm dev
```

命令：

- `pnpm dev` — Vite 开发服务器。
- `pnpm build` — 构建到 `dist/`。
- `pnpm preview` — 本地预览构建结果。
- `pnpm lint` — ESLint 检查，`pnpm lint:fix` — 检查并修复。
- `pnpm format` — 使用 Prettier 格式化。
- `pnpm test` — Vitest 测试，`npx vitest run` — 单次运行。

Service Worker 和 PWA 安装在构建版本中生效：先运行 `pnpm build`，再运行 `pnpm preview`。

## 项目结构

- `src/App.vue` — 根组件：电脑上的表格或手机上的日期栏、全局快捷键、表单打印、窗口和提示消息。
- `src/main.js` — 启动 Vue、Pinia、vue-i18n 和认证。
- `src/i18n.js` — vue-i18n 配置、语言选择和复数规则。
- `src/stores/habitStore.js` — 状态与逻辑：习惯、标记、进度、月份、设置、撤销、导入与导出、登录与同步。
- `src/stores/modalStore.js` — 窗口栈、应用自行打开的窗口队列和提示消息。
- `src/utils/` — 纯函数：`archive.js`（归档、数据校验与修复、习惯转移），`habitMath.js`（进度、连续记录、计划与目标），`stats.js`（统计），`cloudSync.js`（按月同步决策），`csv.js`（CSV），`emojiSearch.js`（表情符号搜索），`sheetLayout.js`（表单几何结构和二维码内容），`sheetScan.js`（表单照片识别）。
- `src/composables/` — `useHabitUtils.js`（月内日期、主题、周），`useModals.js`（窗口场景和用“返回”键关闭），`useGridNavigation.js`（表格中的键盘操作），`useGestures.js`（滑动和长按），`useSearch.js`（搜索）。
- `src/directives/radioGroup.js` — 选项组中的键盘操作。
- `src/components/` — 界面：表格（`HabitGrid`、`HabitRow`、`MarkCircle`），手机（`MobileView`），窗口（`HabitSheet`、`SettingsSheet`、`StatsSheet`、`ImportSheet`、`ConflictSheet`、`NoteSheet`、`SearchSheet` 等），表单与照片（`PaperSheet`、`PhotoImport`）。
- `src/locales/` — 界面词典。
- `src/firebase.js` — 公开的 Firebase Web 配置。
- `firestore.rules` — Firestore 规则：用户只能读写自己的文档。
- 配置：`vite.config.js`（Vite、PWA、Tailwind、Vitest、表情符号数据），`eslint.config.js`，`.prettierrc`。
- 测试 `*.test.js` 与模块放在一起。

## 主要依赖

- [Vue 3](https://vuejs.org/) — 框架。
- [Vite](https://vite.dev/) — 构建工具。
- [Pinia](https://pinia.vuejs.org/) — 状态管理。
- [Tailwind CSS](https://tailwindcss.com/) — 样式。
- [vue-i18n](https://vue-i18n.intlify.dev/) — 本地化。
- [vue-draggable-next](https://github.com/anish2690/vue-draggable-next) — 拖放。
- [lucide-vue-next](https://lucide.dev/) — 图标。
- [Firebase](https://firebase.google.com/) — 登录和云存储。
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — PWA。
- [js-aruco2](https://www.npmjs.com/package/js-aruco2) 和 [jsQR](https://www.npmjs.com/package/jsqr) — 表单识别，[uqr](https://www.npmjs.com/package/uqr) — 表单上的二维码。
- [emojibase-data](https://www.npmjs.com/package/emojibase-data) — 表情符号目录，[Golos Text](https://www.npmjs.com/package/@fontsource-variable/golos-text) — 字体。
- 开发：ESLint、eslint-plugin-vue、Prettier、prettier-plugin-tailwindcss、Vitest、jsdom。

完整列表见 `package.json`。

## 架构与数据

- 归档：`localStorage.habitArchive` = `{ "YYYY-MM": { tasks: [...] } }`。设置保存在单独的键中（`theme`、`lang`、`weekStart`、`showWeekSeparators`、`calculationMode`、`summaryStyle`），导入前的备份保存在 `habitArchiveBackup`，同步元数据保存在 `habitSyncMeta`。
- 习惯：`{ id, title, progress, subtasks: [{ id, marks }], color?, emoji?, schedule?, goal?, paused?, notes? }`。`marks` 中每个元素对应月内的一天：`true` — 已完成，`null` — 未完成，`false` — 跳过。
- Firestore：`users/{uid}` 存放设置和服务字段，月份位于 `users/{uid}/months/{YYYY-MM}`。Firestore 的本地缓存保存在 IndexedDB 中。
- 窗口：窗口栈位于 `modalStore`，由 `ModalEntry.vue` 渲染，“返回”键关闭最上层窗口。
- `src/utils/sheetLayout.js` 中的表单布局由打印和识别共用。识别既能读取横向表单，也能读取 3.4.0 之前版本的纵向表单，格式由标记编号确定。`js-aruco2` 和 `jsqr` 在首次识别时加载。

## 贡献

- Fork 仓库并为你的更改创建分支。
- 代码使用 JavaScript，风格遵循 ESLint 和 Prettier。
- 新的界面文本需添加到 `src/locales/` 中全部 5 个词典。
- 提交拉取请求前运行：`pnpm lint`、`npx vitest run`、`pnpm build`。
- 问题和错误请提交到 [issues](https://github.com/korgmen/table-habit-tracker/issues)。

## 许可证

Apache-2.0 — [LICENSE.txt](./LICENSE.txt)、[NOTICE.txt](./NOTICE.txt)。
