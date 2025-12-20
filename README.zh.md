# Table — 习惯追踪器

[![GitHub stars](https://img.shields.io/github/stars/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/stargazers)
[![GitHub last commit](https://img.shields.io/github/last-commit/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/issues)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/korgmen/table-habit-tracker/blob/main/LICENSE.txt)

[Русский](./README.md) | [English](./README.en.md) | [العربية](./README.ar.md) | [Español](./README.es.md)

**Table** 是一款多功能习惯追踪器，帮助你记录每日任务完成情况，养成持久习惯并分析进度。应用支持浏览器和 PWA（渐进式 Web 应用），具备离线模式、Google 同步和表格打印功能，方便手动填写。

现代技术栈：Vue 3、Vite、Pinia、TailwindCSS、vue-i18n、vue-draggable-next、Lucide icons、ESLint、Prettier、Firebase（用于认证和同步）、Vite PWA。

应用数据本地存储于浏览器（localStorage），按月归档。最多支持 20 个任务，每个任务最多 8 个子任务，保证最佳性能。

![应用截图](https://lebedevcode.ru/table-screenshot-zh.png)

---

## 多语言支持
- 全部界面已翻译（见 `src/locales/`）。
- 支持语言：俄语、英语、阿拉伯语、西班牙语、中文。
- 可在设置中切换语言，或使用系统语言。

## 功能介绍
- **任务与子任务**：添加、编辑、删除任务及子任务（每个任务最多 8 个子任务）。支持拖拽排序（vue-draggable-next）。
- **每日标记**：每日标记：已完成（实心圆）、未完成（空心圆）、跳过（叉号——该天不计入统计）。移动端支持双击快速切换（单击——完成/擦除，双击——跳过）。PC 端：左键——完成/擦除，右键——跳过。
- **工作模式**：
  - 擦除模式（eraser mode）快速删除标记。
  - 删除模式（delete mode）删除任务。
- **月份导航**：切换月份，查看历史归档（数据按月存储于 localStorage）。切换月份时自动归档。
- **统计分析**：每个任务完成率、总体平均完成率、5 分制评分。两种统计模式：全月或仅统计已过天数。
- **数据导入/导出**：导出为 JSON，支持文件导入。与归档完全兼容。
- **主题切换**：浅色、深色或系统主题（自动根据操作系统设置）。
- **语言切换**：俄语、英语、阿拉伯语、西班牙语、中文或系统语言。
- **显示设置**：周分隔线（竖线）、选择周起始日（周一/周日）。
- **快捷键**：快速操作（Escape——重置，E——擦除，D——删除，N——新任务，方向键——切换月份，S——设置）。
- **打印**：支持打印纯净表格（无按钮和界面），便于纸质手动填写。
- **PWA 支持**：可安装为移动应用，离线工作，自动更新并通知。
- **同步功能**：Google 登录后数据云同步（Firebase）。登录时自动加载/保存。
- **弹窗提示**：首次启动欢迎说明，任务复制确认，PWA 更新通知。
- **任务复制**：可将上月任务复制到本月。
- **响应式设计**：完全适配移动设备和平板。
- **限制与优化**：最多 20 个任务保证性能；设置和数据自动保存。

## 项目结构
- `src/App.vue` — 应用主组件（表格、标题、弹窗）。
- `src/main.js` — 初始化 Vue、Pinia、i18n、Firebase。
- `src/stores/habitStore.js` — Pinia store：管理任务、进度、主题、语言、归档、导入导出、周设置、认证与同步。
- `src/locales/` — 本地化文件（每种语言一个 JSON）。
- `src/components/` — 组件：Header、TableHeader、TaskRow、Modal、SettingsModal、Controls、OverallStats 等。
- `src/composables/` — hooks：useHabitUtils（周/主题工具）、useModals（弹窗）。
- `src/style.css` — 全局样式、TailwindCSS、自定义字体。
- `src/firebase.js` — Firebase 配置（认证与 Firestore）。
- 配置文件：`vite.config.js`（Vite、PWA、Tailwind）、`eslint.config.js`（ESLint）、`.prettierrc`（Prettier）、`package.json`（依赖与脚本）。

## 快速开始
1. 克隆仓库：
   ```sh
   git clone https://github.com/korgmen/table-habit-tracker.git
   cd table-habit-tracker
   ```
2. 安装依赖：
   ```sh
   pnpm install
   ```
3. 启动开发模式：
   ```sh
   pnpm run dev
   ```
4. 生产环境构建：
   ```sh
   pnpm run build
   ```
5. 代码检查：
   ```sh
   pnpm run lint        # ESLint 检查
   pnpm run format      # Prettier 格式化
   ```
6. 构建预览：
   ```sh
   pnpm run preview
   ```

PWA：构建后在浏览器打开并安装为应用。离线模式由 Service Worker 支持。

## 主要依赖
- [Vue 3](https://vuejs.org/) — 框架。
- [Vite](https://vitejs.dev/) — 构建工具。
- [Pinia](https://pinia.vuejs.org/) — 状态管理。
- [TailwindCSS](https://tailwindcss.com/) — 样式。
- [vue-i18n](https://vue-i18n.intlify.dev/) — 本地化。
- [vue-draggable-next](https://github.com/anish2690/vue-draggable-next) — 拖拽。
- [lucide-vue-next](https://lucide.dev/) — 图标。
- [Firebase](https://firebase.google.com/) — 认证与云存储。
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — PWA 功能。
- 开发：ESLint、Prettier、eslint-plugin-vue、eslint-plugin-tailwindcss。

完整依赖见 `package.json`。

## 架构与逻辑
- **数据存储**：localStorage 保存任务、标记和归档（键名：`habitArchive`）。按月归档格式 `{ "YYYY-MM": { tasks: [...] } }`。设置单独保存（主题、语言、周）。
- **Pinia store** (`habitStore.js`)：集中管理任务、子任务、标记、统计、主题、语言、导入导出、周、弹窗、认证与 Firestore 同步。
- **本地化**：vue-i18n，JSON 文件存于 `src/locales/`。自动检测系统语言。
- **主题**：系统、浅色/深色。应用于根元素。
- **PWA**：`vite.config.js` 配置 manifest（图标、theme_color）。自动更新并弹窗提示。
- **同步**：Firebase Auth（Google）与 Firestore。数据存储于 `/users/{uid}`。登录时自动加载。
- **弹窗**：通用组件用于确认、警告、自定义内容（欢迎、更新）。
- **优化**：懒加载、响应式设计、触控支持、无障碍（ARIA、focus trap）。

## 快捷键
- Escape —— 重置模式，关闭菜单/设置。
- E —— 切换擦除模式。
- D —— 切换删除模式。
- N —— 新建任务。
- 左/右方向键 —— 切换月份。
- S —— 打开/关闭设置。

## 贡献
欢迎贡献！
- Fork 仓库并创建功能/修复分支。
- 遵循代码风格（Prettier、ESLint）。
- 使用现有组件和 store。
- 新语言请在 `src/locales/` 添加翻译（JSON）。
- PR 前请运行：`pnpm run lint && pnpm run format`。
- PR 说明更改内容，必要时添加测试。

有问题？请提交 issue。

## 许可证
Apache-2.0 – [LICENSE.txt](./LICENSE.txt) | [NOTICE.txt](./NOTICE.txt)