<script setup>
  import { ref, computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { resolveLang } from '@/i18n';
  import Sheet from '@/components/Sheet.vue';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { monthKeyLabel } = useHabitUtils();
  const { t } = useI18n();
  const { toastWithUndo } = useModals(t);

  /** Разошедшиеся месяцы по порядку; данные снимаются при открытии и обновляются вместе со стором */
  const months = computed(() => Object.keys(store.cloudConflict?.months || {}).sort());

  /** Выбор по месяцам: 'local' | 'cloud'; повреждённое облако можно только перезаписать */
  const choices = ref({});
  const invalid = key => !store.cloudConflict?.months[key]?.tasks;
  const choose = (key, value) => {
    if (value === 'cloud' && invalid(key)) return;
    choices.value = { ...choices.value, [key]: value };
  };
  const chooseAll = value => months.value.forEach(key => choose(key, value));
  const allChosen = computed(() => months.value.every(key => choices.value[key]));

  /** Привычек и выполненных отметок в версии месяца */
  const summary = tasks =>
    t('conflict.summary', {
      tasks: tasks.length,
      marks: tasks.reduce(
        (sum, task) =>
          sum +
          task.subtasks.reduce(
            (count, subtask) => count + (subtask.marks?.filter(mark => mark === true).length || 0),
            0
          ),
        0
      ),
    });

  const localSummary = key => summary(store.monthTasks(key) || []);

  const cloudSummary = key => {
    const remote = store.cloudConflict?.months[key];
    if (!remote?.tasks) return t('conflict.invalid');
    const parts = [summary(remote.tasks)];
    if (remote.source === 'legacy') parts.push(t('conflict.legacy'));
    else if (remote.updatedAt) {
      const date = new Date(remote.updatedAt).toLocaleString(resolveLang(store.lang), {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });
      parts.push(t('conflict.changed', { date }));
    }
    return parts.join(' · ');
  };

  const segmentClass = active =>
    active ? 'bg-surface font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'hover:bg-surface/50';

  const apply = () => {
    if (!allChosen.value) return;
    const anyCloud = months.value.some(key => choices.value[key] === 'cloud');
    store.resolveCloudConflict({ ...choices.value });
    modalStore.closeModal();
    if (anyCloud) toastWithUndo(t('conflict.loadedCloud'));
    else modalStore.showToast(t('conflict.keptLocal'));
  };

  /** Закрытие без выбора откладывает решение: статус синхронизации предлагает вернуться к нему */
  const dismiss = () => {
    modalStore.closeModal();
    if (store.cloudConflict) modalStore.showToast(t('conflict.postponed'));
  };
</script>

<template>
  <Sheet :label="t('conflict.title')" @close="dismiss">
    <div class="flex flex-col gap-3 px-6 pt-6 pb-2">
      <span class="text-[22px] font-bold tracking-tight">{{ t('conflict.title') }}</span>
      <span class="text-muted text-[15px] leading-normal text-pretty">
        {{ t('conflict.message') }}
      </span>
      <div v-if="months.length > 1" class="flex flex-wrap gap-2">
        <button
          class="border-line2 hover:bg-soft h-9 rounded-[10px] border px-3 text-[13px]"
          @click="chooseAll('local')"
        >
          {{ t('conflict.allLocal') }}
        </button>
        <button
          class="border-line2 hover:bg-soft h-9 rounded-[10px] border px-3 text-[13px]"
          @click="chooseAll('cloud')"
        >
          {{ t('conflict.allCloud') }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2.5 px-6 pt-2">
      <div
        v-for="key in months"
        :key="key"
        class="border-line flex flex-col gap-2.5 rounded-[14px] border p-3.5"
      >
        <span class="text-[15px] font-semibold">{{ monthKeyLabel(key) }}</span>
        <div class="bg-soft grid grid-cols-2 gap-1 rounded-xl p-1" role="radiogroup">
          <button
            role="radio"
            :aria-checked="choices[key] === 'local'"
            class="flex flex-col items-start gap-0.5 rounded-[9px] px-2.5 py-2 text-start"
            :class="segmentClass(choices[key] === 'local')"
            @click="choose(key, 'local')"
          >
            <span class="text-sm">{{ t('conflict.local') }}</span>
            <span class="text-muted text-xs font-normal">{{ localSummary(key) }}</span>
          </button>
          <button
            role="radio"
            :aria-checked="choices[key] === 'cloud'"
            :disabled="invalid(key)"
            class="flex flex-col items-start gap-0.5 rounded-[9px] px-2.5 py-2 text-start disabled:opacity-50"
            :class="segmentClass(choices[key] === 'cloud')"
            @click="choose(key, 'cloud')"
          >
            <span class="text-sm">{{ t('conflict.cloud') }}</span>
            <span class="text-muted text-xs font-normal">{{ cloudSummary(key) }}</span>
          </button>
        </div>
      </div>
    </div>

    <div
      class="border-line bg-surface sticky bottom-0 mt-4 flex justify-end gap-2 border-t px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)]"
    >
      <button
        class="border-line hover:bg-soft h-11 rounded-xl border px-4 text-sm"
        @click="dismiss"
      >
        {{ t('conflict.later') }}
      </button>
      <button
        class="bg-ink text-bg h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-40"
        :disabled="!allChosen"
        @click="apply"
      >
        {{ t('conflict.apply') }}
      </button>
    </div>
  </Sheet>
</template>
