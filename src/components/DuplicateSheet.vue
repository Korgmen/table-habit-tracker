<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';
  import Sheet from '@/components/Sheet.vue';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { currentMonthLabel, realMonthLabel } = useHabitUtils();
  const { t } = useI18n();

  /** В текущем месяце уже есть привычки: они будут заменены */
  const replaces = computed(() => store.archive[store.realMonthKey]?.tasks?.length > 0);

  const close = () => modalStore.closeModal();

  const confirm = () => {
    const month = realMonthLabel.value;
    store.duplicateToCurrent();
    close();
    modalStore.showToast(t('duplicate.done', { month }));
  };
</script>

<template>
  <Sheet :label="t('duplicate.title', { month: realMonthLabel })" @close="close">
    <div class="flex flex-col gap-3.5 p-6">
      <span class="text-[22px] font-bold tracking-tight">
        {{ t('duplicate.title', { month: realMonthLabel }) }}
      </span>
      <span class="text-muted text-[15px] leading-normal text-pretty">
        {{
          t('duplicate.message', {
            count: store.tasks.length,
            from: currentMonthLabel,
            to: realMonthLabel,
          })
        }}
        {{ replaces ? t('duplicate.replaceWarning', { month: realMonthLabel }) : '' }}
      </span>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="task in store.tasks"
          :key="task.id"
          class="bg-soft flex h-7 items-center rounded-full px-2.5 text-[13px]"
        >
          {{ task.title }}
        </span>
      </div>
    </div>
    <div class="flex justify-end gap-2 px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)]">
      <button class="border-line hover:bg-soft h-11 rounded-xl border px-4 text-sm" @click="close">
        {{ t('common.cancel') }}
      </button>
      <button
        class="h-11 rounded-xl px-5 text-sm font-semibold"
        :class="replaces ? 'bg-danger text-white' : 'bg-ink text-bg'"
        @click="confirm"
      >
        {{
          replaces
            ? t('duplicate.confirmReplace', { month: realMonthLabel })
            : t('duplicate.confirm')
        }}
      </button>
    </div>
  </Sheet>
</template>
