import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Словари эмодзи emojibase для языков интерфейса; у арабского своего нет (берётся en) */
const EMOJI_LANGS = ['en', 'ru', 'es', 'zh'];
/** Группа «компоненты» (тона кожи, части причёсок) сама по себе не эмодзи */
const EMOJI_COMPONENT_GROUP = 2;

/**
 * Модули virtual:emoji/<язык>: эмодзи из emojibase-data без тонов кожи,
 * по порядку, в виде [символ, группа, строка поиска (название и теги)].
 * Полные данные весят 0.6–0.9 МБ на язык, урезанные – 0.1–0.2 МБ.
 */
const emojiData = () => ({
  name: 'emoji-data',
  resolveId(id) {
    if (id.startsWith('virtual:emoji/')) return `\0${id}`;
  },
  load(id) {
    if (!id.startsWith('\0virtual:emoji/')) return;
    const lang = id.split('/').pop();
    if (!EMOJI_LANGS.includes(lang)) throw new Error(`No emoji data for ${lang}`);
    const data = JSON.parse(readFileSync(require.resolve(`emojibase-data/${lang}/compact.json`)));
    const list = data
      .filter(item => item.group !== undefined && item.group !== EMOJI_COMPONENT_GROUP)
      .sort((a, b) => a.order - b.order)
      .map(item => [
        item.unicode,
        item.group,
        [item.label, ...(item.tags || [])].join(' ').toLowerCase(),
      ]);
    return `export default ${JSON.stringify(list)};`;
  },
});

export default defineConfig({
  plugins: [
    emojiData(),
    vue(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicons/favicon.svg', 'robots.txt', 'favicons/apple-touch-icon.png'],
      /** Шрифт приходит из пакета в assets, а по умолчанию workbox не прекэширует woff2 */
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
      },
      /**
       * Манифест один на все языки (локализованных манифестов браузеры не поддерживают): имя –
       * название приложения без перевода, описание короткое. Цвета – светлый фон приложения
       * (--bg), в тёмной теме строку состояния перекрашивает meta theme-color. Пути относительные,
       * чтобы приложение работало и не в корне домена (base в vite).
       */
      manifest: {
        name: 'Table',
        short_name: 'Table',
        description: 'Habit tracker',
        theme_color: '#f7f7f5',
        background_color: '#f7f7f5',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'favicons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'favicons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'favicons/pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
