<script setup>
  import { ref, computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { filledMonths, countTasks, MAX_TITLE } from '@/utils/archive';
  import Sheet from '@/components/Sheet.vue';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { monthKeyLabel } = useHabitUtils();
  const { t } = useI18n();
  const { toastWithUndo } = useModals(t);

  /** Файл разбирается до открытия окна и не меняется, пока оно открыто */
  const pending = store.pendingImport;
  const fromBackup = pending?.source === 'backup';
  const incomingMonths = pending ? filledMonths(pending.archive) : [];
  const hasCurrentData = countTasks(store.archive) > 0;
  const hasSettings = Object.keys(pending?.settings || {}).length > 0;

  /** 'replace' – заменить всё, 'merge' – добавить месяцы из файла к текущим */
  const mode = ref(hasCurrentData && !fromBackup ? 'merge' : 'replace');

  /** Месяцы, заполненные и на устройстве, и в файле; для каждого выбирается, чью версию взять */
  const overlap = incomingMonths.filter(key => store.archive[key]?.tasks?.length > 0);
  const takeIncoming = ref(new Set());

  const summary = computed(() =>
    t('importSheet.summary', {
      months: incomingMonths.length,
      tasks: countTasks(pending?.archive || {}),
      from: monthKeyLabel(incomingMonths[0]),
      to: monthKeyLabel(incomingMonths.at(-1)),
    })
  );

  const modeOptions = computed(() => [
    ['merge', t('importSheet.merge'), t('importSheet.mergeHint')],
    ['replace', t('importSheet.replace'), t('importSheet.replaceHint')],
  ]);

  const segmentClass = active =>
    active ? 'bg-surface font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'hover:bg-soft/50';

  const toggleMonth = (key, fromFile) => {
    const next = new Set(takeIncoming.value);
    if (fromFile) next.add(key);
    else next.delete(key);
    takeIncoming.value = next;
  };

  const close = () => {
    store.cancelImport();
    modalStore.closeModal();
  };

  const confirm = () => {
    store.applyImport({ replace: mode.value === 'replace', takeIncoming: [...takeIncoming.value] });
    modalStore.closeModal();
    toastWithUndo(t(fromBackup ? 'importSheet.restored' : 'import.done'));
  };
</script>

<template>
  <Sheet
    v-if="pending"
    :label="t(fromBackup ? 'importSheet.titleBackup' : 'importSheet.title')"
    @close="close"
  >
    <div class="flex flex-col gap-4 px-6 pt-6 pb-2">
      <span class="text-[22px] font-bold tracking-tight">
        {{ t(fromBackup ? 'importSheet.titleBackup' : 'importSheet.title') }}
      </span>
      <span class="text-muted text-[15px] leading-normal text-pretty">{{ summary }}</span>
      <span v-if="pending.truncated > 0" class="text-muted text-[13px] leading-snug">
        {{ t('importSheet.truncated', { count: pending.truncated, max: MAX_TITLE }) }}
      </span>

      <template v-if="hasCurrentData">
        <div class="bg-soft grid grid-cols-2 gap-1 rounded-xl p-1" role="radiogroup">
          <button
            v-for="[value, label] in modeOptions"
            :key="value"
            role="radio"
            :aria-checked="mode === value"
            class="h-[38px] rounded-[9px] text-sm"
            :class="segmentClass(mode === value)"
            @click="mode = value"
          >
            {{ label }}
          </button>
        </div>
        <span class="text-muted -mt-2 text-xs leading-snug">
          {{ modeOptions.find(([value]) => value === mode)[2] }}
          <template v-if="mode === 'replace' && hasSettings">
            {{ t('importSheet.settingsHint') }}
          </template>
        </span>

        <div v-if="mode === 'merge' && overlap.length > 0" class="flex flex-col gap-2">
          <span class="text-sm font-medium">{{ t('importSheet.overlap') }}</span>
          <div v-for="key in overlap" :key="key" class="flex items-center justify-between gap-3">
            <span class="text-sm first-letter:uppercase">{{ monthKeyLabel(key) }}</span>
            <div
              class="bg-soft flex gap-1 rounded-xl p-1"
              role="radiogroup"
              :aria-label="monthKeyLabel(key)"
            >
              <button
                role="radio"
                :aria-checked="!takeIncoming.has(key)"
                class="h-[30px] rounded-[9px] px-3 text-[13px]"
                :class="segmentClass(!takeIncoming.has(key))"
                @click="toggleMonth(key, false)"
              >
                {{ t('importSheet.keepCurrent') }}
              </button>
              <button
                role="radio"
                :aria-checked="takeIncoming.has(key)"
                class="h-[30px] rounded-[9px] px-3 text-[13px]"
                :class="segmentClass(takeIncoming.has(key))"
                @click="toggleMonth(key, true)"
              >
                {{ t('importSheet.takeFile') }}
              </button>
            </div>
          </div>
        </div>

        <span class="text-muted text-xs leading-snug">{{ t('importSheet.safety') }}</span>
      </template>
    </div>

    <div class="flex justify-end gap-2 px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)]">
      <button class="border-line hover:bg-soft h-11 rounded-xl border px-4 text-sm" @click="close">
        {{ t('common.cancel') }}
      </button>
      <button
        class="h-11 rounded-xl px-5 text-sm font-semibold"
        :class="mode === 'replace' && hasCurrentData ? 'bg-danger text-white' : 'bg-ink text-bg'"
        @click="confirm"
      >
        {{
          mode === 'replace' && hasCurrentData
            ? t('importSheet.confirmReplace')
            : t('importSheet.confirm')
        }}
      </button>
    </div>
  </Sheet>
</template>
