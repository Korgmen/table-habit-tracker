// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import pluginPrettier from 'eslint-plugin-prettier';
import configPrettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/', 'dev-dist/', 'notes/'] },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  configPrettier,
  {
    plugins: {
      prettier: pluginPrettier,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },
];
