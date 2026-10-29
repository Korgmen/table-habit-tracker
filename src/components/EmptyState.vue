<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { monthKey, lastFilledBefore } from '@/utils/archive';
  import { Plus } from 'lucide-vue-next';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { isDesktop, isCurrentMonth, prevMonthLabel, monthKeyLabel } = useHabitUtils();
  const { t } = useI18n();
  const { openNewHabit } = useModals(t);

  /** Текущий месяц: привычки можно перенести из последнего месяца, где они были */
  const carrySource = computed(() =>
    isCurrentMonth.value ? lastFilledBefore(store.archive, store.currentMonthKey) : null
  );

  /** Архивный месяц: в прошлом месяце есть привычки, его можно открыть */
  const prevHasTasks = computed(
    () =>
      !isCurrentMonth.value &&
      store.archive[monthKey(new Date(store.currentYear, store.currentMonth - 1, 1))]?.tasks
        ?.length > 0
  );
</script>

<template>
  <div
    class="border-line flex flex-1 flex-col items-center justify-center gap-2.5 border-t p-8 text-center md:gap-3"
  >
    <span class="text-xl font-bold md:text-2xl md:tracking-tight">{{ t('empty.title') }}</span>
    <span class="text-muted max-w-[280px] text-[15px] leading-normal text-pretty md:max-w-[380px]">
      {{ t('empty.text') }}
    </span>
    <div class="hide-print flex flex-wrap justify-center gap-2 pt-2">
      <button
        class="bg-ink text-bg flex h-[42px] items-center gap-1 rounded-[10px] ps-3.5 pe-[18px] text-sm font-semibold hover:opacity-90"
        @click="openNewHabit"
      >
        <Plus class="size-4" :stroke-width="2.5" />
        {{ t('header.newHabitLong') }}
      </button>
      <button
        v-if="carrySource"
        class="border-line bg-surface hover:bg-soft h-[42px] rounded-[10px] border px-[18px] text-sm"
        @click="modalStore.showModal('duplicate', { from: carrySource })"
      >
        {{ t('empty.carry', { month: monthKeyLabel(carrySource) }) }}
      </button>
      <button
        v-else-if="prevHasTasks"
        class="border-line bg-surface hover:bg-soft h-[42px] rounded-[10px] border px-[18px] text-sm"
        @click="store.prevMonth()"
      >
        {{ t('empty.openPrev', { month: prevMonthLabel }) }}
      </button>
    </div>
    <span v-if="isDesktop" class="hide-print text-muted text-xs">{{ t('empty.hotkey') }}</span>
  </div>
</template>
