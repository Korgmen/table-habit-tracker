<script setup>
  import { ref, computed, watch } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useI18n } from 'vue-i18n';
  import { useModalEntry } from '@/composables/useModals';
  import { intlLocale } from '@/i18n';
  import { MAX_NOTE } from '@/utils/archive';
  import { X, ChevronLeft, ChevronRight } from 'lucide-vue-next';
  import Sheet from '@/components/Sheet.vue';

  const props = defineProps({
    /** ID привычки */
    taskId: { type: [Number, String], required: true },
    /** Число месяца, к которому заметка */
    day: { type: Number, required: true },
  });

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { t } = useI18n();
  const { close } = useModalEntry();

  const task = computed(() => store.tasks.find(item => item.id === props.taskId) || null);

  /** Заметки бывают только у наступивших дней, как и отметки */
  const day = ref(Math.min(Math.max(props.day, 1), store.today));
  const saved = computed(() => task.value?.notes?.[day.value - 1] || '');
  const draft = ref(saved.value);

  /** Переход на другой день сохраняет набранное к прежнему */
  watch(day, (_value, previous) => {
    const text = draft.value.trim();
    if (text !== (task.value?.notes?.[previous - 1] || '')) {
      store.setNote(props.taskId, previous - 1, text);
    }
    draft.value = saved.value;
  });

  /** Привычку удалили или сменился месяц: заметку больше не к чему привязать */
  watch(task, value => {
    if (!value) close();
  });

  const dateLabel = computed(() =>
    new Date(store.currentYear, store.currentMonth, day.value).toLocaleDateString(
      intlLocale(store.lang),
      { weekday: 'short', day: 'numeric', month: 'long' }
    )
  );

  const save = () => {
    const text = draft.value.trim();
    if (text !== saved.value) {
      store.setNote(props.taskId, day.value - 1, text);
      modalStore.showToast(t(text ? 'note.saved' : 'note.deleted'));
    }
    close();
  };

  const remove = () => {
    draft.value = '';
    save();
  };
</script>

<template>
  <Sheet v-if="task" :label="t('note.title')" @close="close">
    <form class="flex flex-col" @submit.prevent="save">
      <div class="flex items-center justify-between gap-3 px-6 pt-5 pb-2">
        <span class="flex min-w-0 flex-col">
          <span class="text-[22px] font-bold tracking-tight">{{ t('note.title') }}</span>
          <span class="text-muted truncate text-[13px]">
            {{ task.emoji ? `${task.emoji} ${task.title}` : task.title }}
          </span>
        </span>
        <button
          type="button"
          class="bg-soft flex size-10 shrink-0 items-center justify-center rounded-full"
          :aria-label="t('common.close')"
          @click="close"
        >
          <X class="size-5" />
        </button>
      </div>

      <div class="flex flex-col gap-3 px-6 pt-2 pb-6">
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="disabled:text-faint flex size-10 items-center justify-center rounded-full"
            :disabled="day <= 1"
            :aria-label="t('note.prevDay')"
            @click="day--"
          >
            <ChevronLeft class="size-5 rtl:-scale-x-100" />
          </button>
          <span class="flex-1 text-center text-sm font-medium" aria-live="polite">
            {{ dateLabel }}
          </span>
          <button
            type="button"
            class="disabled:text-faint flex size-10 items-center justify-center rounded-full"
            :disabled="day >= store.today"
            :aria-label="t('note.nextDay')"
            @click="day++"
          >
            <ChevronRight class="size-5 rtl:-scale-x-100" />
          </button>
        </div>
        <textarea
          v-model="draft"
          rows="5"
          autofocus
          :maxlength="MAX_NOTE"
          :placeholder="t('note.placeholder')"
          :aria-label="t('note.title')"
          class="border-line2 bg-bg focus:border-ink resize-none rounded-xl border-[1.5px] p-3.5 text-base outline-none"
        ></textarea>
        <span class="text-muted self-end text-xs">{{ draft.length }} / {{ MAX_NOTE }}</span>
      </div>

      <div
        class="border-line bg-surface sticky bottom-0 flex items-center gap-2 border-t px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)]"
      >
        <button
          v-if="saved"
          type="button"
          class="text-danger h-11 px-1 text-sm font-semibold"
          @click="remove"
        >
          {{ t('common.delete') }}
        </button>
        <div class="flex-1"></div>
        <button
          type="button"
          class="border-line hover:bg-soft h-11 rounded-xl border px-4 text-sm"
          @click="close"
        >
          {{ t('common.cancel') }}
        </button>
        <button type="submit" class="bg-ink text-bg h-11 rounded-xl px-5 text-sm font-semibold">
          {{ t('common.save') }}
        </button>
      </div>
    </form>
  </Sheet>
</template>
