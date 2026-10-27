<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';
  import { resolveLang } from '@/i18n';
  import Sheet from '@/components/Sheet.vue';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { realMonthLabel } = useHabitUtils();
  const { t } = useI18n();

  /** Сколько месяцев с привычками в архиве и привычек в текущем месяце */
  const summary = archive => {
    const months = Object.values(archive || {}).filter(month => month?.tasks?.length > 0).length;
    const tasks = archive?.[store.realMonthKey]?.tasks?.length || 0;
    return t('conflict.summary', { months, tasks, month: realMonthLabel.value });
  };

  const localSummary = computed(() => summary(store.archive));
  const cloudSummary = computed(() => summary(store.cloudConflict?.archive));
  const cloudDate = computed(() => {
    const updatedAt = store.cloudConflict?.updatedAt;
    if (!updatedAt) return '';
    return new Date(updatedAt).toLocaleString(resolveLang(store.lang), {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  const resolve = keepLocal => {
    store.resolveCloudConflict(keepLocal);
    modalStore.closeModal();
    modalStore.showToast(t(keepLocal ? 'conflict.keptLocal' : 'conflict.loadedCloud'));
  };

  /** Закрытие без выбора оставляет синхронизацию выключенной до следующего входа */
  const dismiss = () => modalStore.closeModal();
</script>

<template>
  <Sheet :label="t('conflict.title')" @close="dismiss">
    <div class="flex flex-col gap-3 px-6 pt-6 pb-2">
      <span class="text-[22px] font-bold tracking-tight">{{ t('conflict.title') }}</span>
      <span class="text-muted text-[15px] leading-normal text-pretty">
        {{ t('conflict.message') }}
      </span>
    </div>
    <div class="flex flex-col gap-2.5 px-6 pt-2 pb-[max(env(safe-area-inset-bottom),24px)]">
      <button
        class="border-ink hover:bg-soft flex items-center gap-3 rounded-[14px] border-[1.5px] p-4 text-start"
        @click="resolve(true)"
      >
        <span class="flex flex-1 flex-col gap-[3px]">
          <span class="text-[15px] font-semibold">{{ t('conflict.local') }}</span>
          <span class="text-muted text-[13px]">{{ localSummary }}</span>
        </span>
        <span class="text-[13px] font-semibold">{{ t('conflict.keep') }}</span>
      </button>
      <button
        class="border-line2 hover:bg-soft flex items-center gap-3 rounded-[14px] border p-4 text-start"
        @click="resolve(false)"
      >
        <span class="flex flex-1 flex-col gap-[3px]">
          <span class="text-[15px] font-semibold">{{ t('conflict.cloud') }}</span>
          <span class="text-muted text-[13px]">
            {{ cloudSummary }}
            <template v-if="cloudDate">· {{ t('conflict.changed', { date: cloudDate }) }}</template>
          </span>
        </span>
        <span class="text-[13px] font-semibold">{{ t('conflict.load') }}</span>
      </button>
    </div>
  </Sheet>
</template>
