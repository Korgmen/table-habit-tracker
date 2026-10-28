<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useI18n } from 'vue-i18n';

  const props = defineProps({
    /** Подробный вид для настроек: причина ошибки и кнопка действия текстом */
    detailed: Boolean,
  });

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { t } = useI18n();

  /** Из настроек окно выбора версии открывается вместо них, из шапки – как обычно */
  const showCloudConflict = () =>
    props.detailed ? modalStore.replaceModal('conflict') : modalStore.showModal('conflict');

  /** Коды ошибок Firestore, для которых есть отдельное объяснение в словаре */
  const REASON_KEYS = {
    'permission-denied': 'permissionDenied',
    unauthenticated: 'unauthenticated',
    'resource-exhausted': 'resourceExhausted',
    'too-large': 'tooLarge',
  };

  const dotClass = computed(() => {
    if (store.syncState === 'synced') return 'bg-ok';
    if (['error', 'conflict'].includes(store.syncState)) return 'bg-danger';
    return 'bg-line2';
  });

  const reason = computed(() => {
    if (store.syncState === 'offline') return t('sync.reason.offline');
    if (store.syncState === 'conflict') return t('sync.reason.conflict');
    if (store.syncState !== 'error') return '';
    return t(`sync.reason.${REASON_KEYS[store.syncError] || 'unknown'}`);
  });

  /** Действие, которое двигает синхронизацию дальше: выбор версии или повтор */
  const action = computed(() => {
    if (store.syncState === 'conflict') return { text: t('sync.choose'), run: showCloudConflict };
    if (['error', 'offline'].includes(store.syncState)) {
      return { text: t('sync.retry'), run: () => store.retrySync() };
    }
    return null;
  });
</script>

<template>
  <span v-if="detailed" class="flex flex-col gap-1">
    <span class="text-muted flex items-center gap-1.5 text-xs">
      <span class="size-[7px] shrink-0 rounded-full" :class="dotClass"></span>
      {{ t(`sync.state.${store.syncState}`) }}
    </span>
    <span v-if="reason" class="text-muted text-xs leading-snug">{{ reason }}</span>
    <button
      v-if="action"
      class="self-start text-xs font-semibold underline underline-offset-3"
      @click="action.run"
    >
      {{ action.text }}
    </button>
  </span>
  <button
    v-else-if="action"
    class="text-muted hover:text-ink flex items-center gap-1.5 text-[13px]"
    :title="reason"
    @click="action.run"
  >
    <span class="size-[7px] rounded-full" :class="dotClass"></span>
    {{ t(`sync.state.${store.syncState}`) }} · {{ action.text }}
  </button>
  <span v-else class="text-muted flex items-center gap-1.5 text-[13px]">
    <span class="size-[7px] rounded-full" :class="dotClass"></span>
    {{ t(`sync.state.${store.syncState}`) }}
  </span>
</template>
