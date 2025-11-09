## Table — 习惯追踪器 — Vue 3 + Vite (中文)

多功能习惯追踪应用，支持任务、子任务、每日标记、数据导入导出、主题和语言切换。现代技术栈：Vue 3、Vite、Pinia、TailwindCSS、i18n、ESLint、Prettier。

---

## 多语言支持
- 支持语言：俄语、英语、阿拉伯语、西班牙语、中文
- 所有界面文本均已本地化（见 `src/locales/`）
- 可在设置中切换应用语言

## 功能
- 添加、编辑、删除任务和子任务
- 每个任务/子任务每日标记
- 月份切换，归档查看
- 数据导出和导入（JSON）
- 主题切换（浅色/深色/系统）
- 语言切换（俄语/英语/阿拉伯语/西班牙语/中文/系统）
- 任务拖拽（vue-draggable-next）
- 响应式设计，支持打印
- 周显示设置：周分隔符，选择周起始日（星期一/星期天）
- 快捷键快速控制
- 所有设置均会在会话间保存

## 项目结构
- `src/App.vue` — 应用主组件
- `src/main.js` — Vue、Pinia、i18n 初始化
- `src/stores/habitStore.js` — Pinia store：任务、进度、主题、语言、导入导出、周设置逻辑
- `src/locales/` — 本地化文件
- `src/components/` — 应用组件
- `src/style.css` — TailwindCSS 和全局样式
- 配置：`vite.config.js`、`eslint.config.js`、`.prettierrc`

## 快速开始
```sh
pnpm install         # 安装依赖
pnpm run dev         # 启动开发服务器
pnpm run build       # 构建生产版本
pnpm run lint        # 代码检查
pnpm run format      # 代码格式化
```

## 主要依赖
- [Vue 3](https://vuejs.org/) — 框架
- [Vite](https://vitejs.dev/) — 构建工具
- [Pinia](https://pinia.vuejs.org/) — 状态管理
- [TailwindCSS](https://tailwindcss.com/) — 样式
- [vue-i18n](https://vue-i18n.intlify.dev/) — 本地化
- [vue-draggable-next](https://github.com/anish2690/vue-draggable-next) — 拖拽
- [lucide-vue-next](https://lucide.dev/) — 图标

## 架构与逻辑
- 所有任务和标记数据存储在 localStorage（按月归档）
- Pinia store (`habitStore.js`) 管理任务、子任务、进度、主题、语言、导入导出、周设置
- 通过 vue-i18n 实现本地化，翻译在 `src/locales/`
- 主题、语言和周设置会持久化
- 拖拽通过 vue-draggable-next 实现

## 快捷键
- Escape — 重置模式，关闭菜单/设置
- E — 切换橡皮擦模式
- D — 切换删除模式
- N — 添加新任务
- 左/右箭头 — 切换月份
- S — 打开/关闭设置

## 贡献
- 遵循代码风格（Prettier, ESLint）
- 使用现有组件和 store
- 新语言请在 `src/locales/` 添加翻译
- Pull request 前请运行：`pnpm run lint && pnpm run format`

## 许可证
Apache-2.0 – [LICENSE.txt](./LICENSE.txt)
