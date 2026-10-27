<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { Plus } from 'lucide-vue-next';
  import MonthNav from '@/components/MonthNav.vue';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { isCurrentMonth, todayDay } = useHabitUtils();
  const { t } = useI18n();
  const { openNewHabit } = useModals(t);

  /** Выполнено отметок за сегодня из учитываемых (без пропусков) */
  const todayStats = computed(() => {
    const index = todayDay.value - 1;
    let done = 0;
    let total = 0;
    store.tasks.forEach(task =>
      task.subtasks.forEach(subtask => {
        if (subtask.marks[index] !== false) total++;
        if (subtask.marks[index] === true) done++;
      })
    );
    return { done, total };
  });
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
      <span v-if="store.user" class="text-muted flex items-center gap-1.5 pe-1.5 text-[13px]">
        <span
          class="size-[7px] rounded-full"
          :class="store.isAuthReady ? 'bg-ok' : 'bg-line2'"
        ></span>
        {{ store.isAuthReady ? t('sync.synced') : t('sync.waiting') }}
      </span>
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
