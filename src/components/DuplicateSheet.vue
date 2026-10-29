<script setup>
  import { ref, computed, watch } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { filledMonths, lastFilledBefore, MAX_TASKS } from '@/utils/archive';
  import Sheet from '@/components/Sheet.vue';

  const props = defineProps({
    /** Месяц-источник 'YYYY-MM'; по умолчанию последний месяц с привычками до текущего */
    from: { type: String, default: null },
  });

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { realMonthLabel, monthKeyLabel } = useHabitUtils();
  const { t } = useI18n();
  const { toastWithUndo } = useModals(t);

  /** Месяцы, из которых можно перенести: с привычками и раньше текущего */
  const sources = computed(() =>
    filledMonths(store.archive)
      .filter(key => key < store.realMonthKey)
      .reverse()
  );

  const source = ref(props.from || lastFilledBefore(store.archive, store.realMonthKey));
  const sourceTasks = computed(() => store.monthTasks(source.value) || []);

  /** Выбранные привычки: при смене месяца – все */
  const selected = ref(new Set());
  watch(
    sourceTasks,
    tasks => {
      selected.value = new Set(tasks.map(task => task.id));
    },
    { immediate: true }
  );

  const toggle = id => {
    const next = new Set(selected.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected.value = next;
  };

  /** Привычки текущего месяца: к ним можно добавить или заменить их */
  const current = computed(() => store.monthTasks(store.realMonthKey) || []);
  const mode = ref('append');
  const replaces = computed(() => current.value.length > 0 && mode.value === 'replace');
  const overLimit = computed(
    () => (replaces.value ? 0 : current.value.length) + selected.value.size > MAX_TASKS
  );

  const modeOptions = computed(() => [
    ['append', t('duplicate.modeAppend')],
    ['replace', t('duplicate.modeReplace')],
  ]);

  const segmentClass = active =>
    active ? 'bg-surface font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'hover:bg-surface/50';

  const close = () => modalStore.closeModal();

  const confirm = () => {
    const month = realMonthLabel.value;
    const done = store.carryOver(source.value, {
      taskIds: [...selected.value],
      replace: current.value.length === 0 || mode.value === 'replace',
    });
    close();
    if (done) toastWithUndo(t('duplicate.done', { month }));
  };
</script>

<template>
  <Sheet :label="t('duplicate.title', { month: realMonthLabel })" @close="close">
    <div class="flex flex-col gap-4 p-6">
      <span class="text-[22px] font-bold tracking-tight">
        {{ t('duplicate.title', { month: realMonthLabel }) }}
      </span>

      <label v-if="sources.length > 1" class="flex items-center justify-between gap-3">
        <span class="text-sm font-medium">{{ t('duplicate.from') }}</span>
        <select
          v-model="source"
          class="border-line2 bg-surface h-10 min-w-[180px] rounded-[10px] border px-3 text-sm"
        >
          <option v-for="key in sources" :key="key" :value="key">{{ monthKeyLabel(key) }}</option>
        </select>
      </label>

      <span class="text-muted text-[15px] leading-normal text-pretty">
        {{
          t('duplicate.message', {
            count: selected.size,
            from: monthKeyLabel(source),
            to: realMonthLabel,
          })
        }}
      </span>

      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="task in sourceTasks"
          :key="task.id"
          type="button"
          :aria-pressed="selected.has(task.id)"
          class="flex h-8 items-center rounded-full border px-3 text-[13px]"
          :class="selected.has(task.id) ? 'border-ink bg-ink text-bg' : 'border-line2 text-muted'"
          @click="toggle(task.id)"
        >
          <template v-if="task.emoji">{{ task.emoji }}&nbsp;</template>
          {{ task.title }}
        </button>
      </div>

      <div v-if="current.length > 0" class="flex flex-col gap-2">
        <div class="bg-soft grid grid-cols-2 gap-1 rounded-xl p-1" role="radiogroup">
          <button
            v-for="[value, label] in modeOptions"
            :key="value"
            type="button"
            role="radio"
            :aria-checked="mode === value"
            class="h-[38px] rounded-[9px] text-sm"
            :class="segmentClass(mode === value)"
            @click="mode = value"
          >
            {{ label }}
          </button>
        </div>
        <span v-if="replaces" class="text-danger text-xs leading-snug">
          {{ t('duplicate.replaceWarning', { month: realMonthLabel }) }}
        </span>
      </div>

      <span v-if="overLimit" class="text-danger text-xs leading-snug" role="alert">
        {{ t('taskLimit', { max: MAX_TASKS }) }}
      </span>
    </div>
    <div class="flex justify-end gap-2 px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)]">
      <button class="border-line hover:bg-soft h-11 rounded-xl border px-4 text-sm" @click="close">
        {{ t('common.cancel') }}
      </button>
      <button
        class="h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-40"
        :class="replaces ? 'bg-danger text-white' : 'bg-ink text-bg'"
        :disabled="selected.size === 0 || overLimit"
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
