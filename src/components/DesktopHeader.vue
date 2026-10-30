<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useSearch } from '@/composables/useSearch';
  import { useI18n } from 'vue-i18n';
  import { dayTotals } from '@/utils/habitMath';
  import { Plus, Undo2, Redo2, Search, X, ChartColumn } from 'lucide-vue-next';
  import MonthNav from '@/components/MonthNav.vue';
  import SyncStatus from '@/components/SyncStatus.vue';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { isCurrentMonth, todayDay, modKey, starsText } = useHabitUtils();
  const { t } = useI18n();
  const { openNewHabit, openStats, undoLast, redoLast } = useModals(t);
  const { query, searchInput, clearSearch } = useSearch();

  /** Выполнено отметок за сегодня из учитываемых (без пропусков и пауз) */
  const todayStats = computed(() => dayTotals(store.tasks, todayDay.value - 1));

  /** Escape в поле поиска сбрасывает фильтр и возвращает горячие клавиши */
  const leaveSearch = () => {
    clearSearch();
    searchInput.value?.blur();
  };
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-7 gap-y-3 px-8 pt-6 pb-[18px]">
    <MonthNav />

    <div class="flex items-baseline gap-6">
      <div v-if="store.summaryKind !== 'hidden'" class="flex items-baseline gap-2">
        <span class="text-muted text-[13px]">{{ t('stats.average') }}</span>
        <span class="text-lg font-bold">{{ store.overallProgress }}%</span>
      </div>
      <div
        v-if="store.summaryKind !== 'hidden' && store.overallGrade !== null"
        class="flex items-baseline gap-2"
      >
        <span class="text-muted text-[13px]">{{ t('stats.grade') }}</span>
        <span
          v-if="store.summaryKind === 'stars'"
          class="text-lg font-bold tracking-wider"
          :aria-label="t('summary.stars', { count: store.overallGrade })"
        >
          {{ starsText(store.overallGrade) }}
        </span>
        <span v-else class="text-lg font-bold">{{ store.overallGrade }}</span>
      </div>
      <div
        v-if="isCurrentMonth && store.tasks.length > 0"
        class="hide-print flex items-baseline gap-2"
      >
        <span class="text-muted text-[13px]">{{ t('stats.today') }}</span>
        <span class="text-lg font-bold">{{ todayStats.done }}/{{ todayStats.total }}</span>
      </div>
    </div>

    <div class="flex-1"></div>

    <div class="hide-print flex flex-wrap items-center gap-2">
      <SyncStatus v-if="store.user" class="pe-1.5" />
      <!-- Фильтр привычек месяца: название, эмодзи, заметки -->
      <label
        v-if="store.tasks.length > 0"
        class="border-line bg-surface focus-within:border-ink flex h-[38px] w-48 items-center gap-1.5 rounded-[10px] border ps-2.5 pe-1"
        :title="t('header.searchHint')"
      >
        <Search class="text-muted size-4 shrink-0" />
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          :placeholder="t('search.placeholder')"
          :aria-label="t('search.placeholder')"
          class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
          @keydown.esc.stop="leaveSearch"
        />
        <button
          v-if="query"
          class="text-muted hover:text-ink flex size-7 shrink-0 items-center justify-center"
          :aria-label="t('search.clear')"
          @click="clearSearch"
        >
          <X class="size-4" />
        </button>
      </label>
      <button
        class="border-line bg-surface hover:bg-soft flex h-[38px] items-center gap-1.5 rounded-[10px] border px-3 text-sm"
        :title="t('header.statsHint')"
        @click="openStats"
      >
        <ChartColumn class="size-4" />
        {{ t('stats.title') }}
      </button>
      <div class="border-line bg-surface flex h-[38px] items-center rounded-[10px] border">
        <button
          class="enabled:hover:bg-soft disabled:text-line2 flex h-full w-9 items-center justify-center rounded-s-[10px]"
          :disabled="!store.canUndo"
          :aria-label="t('history.undo')"
          :title="t('history.undoHint', { key: `${modKey}+Z` })"
          @click="undoLast"
        >
          <Undo2 class="size-4 rtl:-scale-x-100" />
        </button>
        <button
          class="enabled:hover:bg-soft disabled:text-line2 flex h-full w-9 items-center justify-center rounded-e-[10px]"
          :disabled="!store.canRedo"
          :aria-label="t('history.redo')"
          :title="t('history.redoHint', { key: `${modKey}+Shift+Z` })"
          @click="redoLast"
        >
          <Redo2 class="size-4 rtl:-scale-x-100" />
        </button>
      </div>
      <button
        class="border-line bg-surface hover:bg-soft h-[38px] rounded-[10px] border px-3.5 text-sm"
        :title="t('header.settingsHint')"
        @click="modalStore.showModal('settings')"
      >
        {{ t('settings.title') }}
      </button>
      <button
        class="bg-ink text-bg flex h-[38px] items-center gap-1 rounded-[10px] ps-3 pe-4 text-sm font-semibold whitespace-nowrap hover:opacity-90"
        :title="t('header.newHabitHint')"
        @click="openNewHabit"
      >
        <Plus class="size-4" :stroke-width="2.5" />
        {{ t('header.newHabit') }}
      </button>
    </div>
  </div>
</template>
