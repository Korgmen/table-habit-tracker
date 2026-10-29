<script>
  /** Индексы эмодзи по языку данных: словарь грузится один раз за сеанс */
  const indexes = new Map();

  /** Словари эмодзи (virtual:emoji/<язык>, см. vite.config.js) – отдельными файлами по требованию */
  const loaders = {
    en: () => import('virtual:emoji/en'),
    ru: () => import('virtual:emoji/ru'),
    es: () => import('virtual:emoji/es'),
    zh: () => import('virtual:emoji/zh'),
    /** Арабского словаря в emojibase нет: поиск по-английски */
    ar: () => import('virtual:emoji/en'),
  };
</script>

<script setup>
  import { ref, computed, watch } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useI18n } from 'vue-i18n';
  import { resolveLang } from '@/i18n';
  import { buildEmojiIndex, searchEmoji, suggestEmoji, emojiInText } from '@/utils/emojiSearch';
  import { Search } from 'lucide-vue-next';

  const props = defineProps({
    /** Выбранный эмодзи */
    modelValue: { type: String, default: '' },
    /** Название привычки: по нему подбираются подсказки */
    title: { type: String, default: '' },
  });

  const emit = defineEmits([
    /** Выбран эмодзи; пустая строка – без эмодзи */
    'pick',
  ]);

  const store = useHabitStore();
  const { t } = useI18n();

  /** Группы emojibase (2 – компоненты – пропущена) и значок вкладки */
  const GROUPS = [
    [0, 'smileys', '😀'],
    [1, 'people', '👋'],
    [3, 'animals', '🐶'],
    [4, 'food', '🍎'],
    [5, 'travel', '✈️'],
    [6, 'activities', '⚽'],
    [7, 'objects', '💡'],
    [8, 'symbols', '❤️'],
    [9, 'flags', '🏳️'],
  ];

  const index = ref(null);
  const failed = ref(false);
  const query = ref('');
  const group = ref(GROUPS[0][0]);

  const load = async lang => {
    failed.value = false;
    if (indexes.has(lang)) {
      index.value = indexes.get(lang);
      return;
    }
    index.value = null;
    try {
      const { default: list } = await loaders[lang]();
      indexes.set(lang, buildEmojiIndex(list));
      if (resolveLang(store.lang) === lang) index.value = indexes.get(lang);
    } catch (error) {
      console.error(error);
      failed.value = true;
    }
  };

  watch(() => resolveLang(store.lang), load, { immediate: true });

  const suggestions = computed(() =>
    index.value && !query.value.trim() ? suggestEmoji(index.value, props.title) : []
  );

  /** Найденные эмодзи; введённые в поиск эмодзи идут первыми, их можно выбрать как есть */
  const results = computed(() => {
    if (!index.value) return [];
    if (!query.value.trim()) {
      return index.value.filter(entry => entry.group === group.value).map(entry => entry.emoji);
    }
    return [...new Set([...emojiInText(query.value), ...searchEmoji(index.value, query.value)])];
  });

  const cellClass = emoji =>
    emoji === props.modelValue ? 'bg-soft ring-ink ring-[1.5px]' : 'hover:bg-soft';
</script>

<template>
  <div class="border-line flex flex-col gap-2.5 rounded-[14px] border p-3">
    <label
      class="border-line2 bg-bg focus-within:border-ink flex h-10 items-center gap-2 rounded-[10px] border-[1.5px] px-3"
    >
      <Search class="text-muted size-4 shrink-0" />
      <input
        v-model="query"
        type="search"
        :placeholder="t('emoji.search')"
        :aria-label="t('emoji.search')"
        class="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
    </label>

    <div v-if="suggestions.length > 0" class="flex flex-col gap-1">
      <span class="text-muted text-xs">{{ t('emoji.suggested') }}</span>
      <div class="grid grid-cols-8 gap-1">
        <button
          v-for="emoji in suggestions"
          :key="emoji"
          type="button"
          class="flex aspect-square items-center justify-center rounded-[10px] text-xl"
          :class="cellClass(emoji)"
          :aria-pressed="emoji === modelValue"
          @click="emit('pick', emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </div>

    <div
      v-if="!query.trim()"
      class="border-line flex gap-0.5 overflow-x-auto border-t pt-2 [scrollbar-width:none]"
      role="tablist"
      :aria-label="t('emoji.groups.title')"
    >
      <button
        v-for="[value, key, icon] in GROUPS"
        :key="value"
        type="button"
        role="tab"
        :aria-selected="group === value"
        :aria-label="t(`emoji.groups.${key}`)"
        :title="t(`emoji.groups.${key}`)"
        class="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-lg"
        :class="group === value ? 'bg-soft' : 'opacity-60 hover:opacity-100'"
        @click="group = value"
      >
        {{ icon }}
      </button>
    </div>

    <div class="h-52 overflow-y-auto">
      <span v-if="failed" class="text-muted block py-6 text-center text-sm">
        {{ t('emoji.failed') }}
      </span>
      <span v-else-if="!index" class="text-muted block py-6 text-center text-sm">
        {{ t('emoji.loading') }}
      </span>
      <span v-else-if="results.length === 0" class="text-muted block py-6 text-center text-sm">
        {{ t('emoji.empty') }}
      </span>
      <div v-else class="grid grid-cols-8 gap-1">
        <button
          v-for="emoji in results"
          :key="emoji"
          type="button"
          class="flex aspect-square items-center justify-center rounded-[10px] text-xl"
          :class="cellClass(emoji)"
          :aria-pressed="emoji === modelValue"
          @click="emit('pick', emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </div>

    <button
      type="button"
      class="border-line hover:bg-soft h-10 rounded-[10px] border px-3 text-sm disabled:opacity-40"
      :disabled="!modelValue"
      @click="emit('pick', '')"
    >
      {{ t('habit.emojiNone') }}
    </button>
  </div>
</template>
