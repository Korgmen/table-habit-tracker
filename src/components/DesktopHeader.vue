<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { dayTotals } from '@/utils/habitMath';
  import { Plus, Undo2, Redo2 } from 'lucide-vue-next';
  import MonthNav from '@/components/MonthNav.vue';
  import SyncStatus from '@/components/SyncStatus.vue';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { isCurrentMonth, todayDay, modKey } = useHabitUtils();
  const { t } = useI18n();
  const { openNewHabit, undoLast, redoLast } = useModals(t);

  /** Выполнено отметок за сегодня из учитываемых (без пропусков и пауз) */
  const todayStats = computed(() => dayTotals(store.tasks, todayDay.value - 1));
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-7 gap-y-3 px-8 pt-6 pb-[18px]">
    <MonthNav />

    <div class="flex items-baseline gap-6">
      <div class="flex items-baseline gap-2">
        <span class="text-muted text-[13px]">{{ t('stats.average') }}</span>
        <span class="text-lg font-bold">{{ store.overallProgress }}%</span>
      </div>
      <div class="flex items-baseline gap-2">
        <span class="text-muted text-[13px]">{{ t('stats.grade') }}</span>
        <span class="text-lg font-bold">{{ store.overallGrade }}</span>
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

    <div class="hide-print flex items-center gap-2">
      <SyncStatus v-if="store.user" class="pe-1.5" />
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
