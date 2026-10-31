<script setup>
  import { ref, computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModalEntry } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { searchArchive } from '@/utils/stats';
  import { X, Search } from 'lucide-vue-next';
  import Sheet from '@/components/Sheet.vue';

  const props = defineProps({
    /** Начальный запрос (из фильтра таблицы или списка) */
    query: { type: String, default: '' },
  });

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { monthKeyLabel, monthShortLabel, dayDateLabel, habitColorStyle } = useHabitUtils();
  const { t } = useI18n();

  const text = ref(props.query);
  const results = computed(() => searchArchive(store.archiveView, text.value));
  const isEmpty = computed(
    () => text.value.trim() && !results.value.habits.length && !results.value.notes.length
  );

  const { close, closeAll } = useModalEntry();

  /** Месяц привычки из результатов: окна закрываются, открывается месяц */
  const openMonth = key => {
    closeAll();
    store.openMonthKey(key);
  };

  /** Заметка открывается в своём месяце поверх поиска: закрытие возвращает к результатам */
  const openNote = note => {
    store.openMonthKey(note.key);
    modalStore.openModal('note', { taskId: note.taskId, day: note.day });
  };
</script>

<template>
  <Sheet :label="t('search.title')" @close="close">
    <div class="bg-surface sticky top-0 z-[1] flex flex-col gap-3 px-6 pt-5 pb-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-[22px] font-bold tracking-tight">{{ t('search.title') }}</span>
        <button
          class="bg-soft flex size-10 items-center justify-center rounded-full"
          :aria-label="t('common.close')"
          @click="close"
        >
          <X class="size-5" />
        </button>
      </div>
      <label
        class="border-line2 bg-bg focus-within:border-ink flex h-12 items-center gap-2 rounded-xl border-[1.5px] px-3.5"
      >
        <Search class="text-muted size-4 shrink-0" />
        <input
          v-model="text"
          type="search"
          enterkeyhint="search"
          autofocus
          :placeholder="t('search.placeholder')"
          :aria-label="t('search.placeholder')"
          class="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </label>
    </div>

    <div class="flex flex-col gap-6 px-6 pt-1 pb-[max(env(safe-area-inset-bottom),24px)]">
      <span v-if="!text.trim()" class="text-muted text-sm">{{ t('search.hint') }}</span>
      <span v-else-if="isEmpty" class="text-muted text-sm">{{ t('search.none') }}</span>

      <!-- Привычки: в каких месяцах были -->
      <section v-if="results.habits.length" class="flex flex-col gap-2.5">
        <h3 class="text-muted text-xs font-semibold tracking-wider uppercase">
          {{ t('search.habits') }}
        </h3>
        <div
          v-for="habit in results.habits"
          :key="habit.key"
          class="border-line flex flex-col gap-2 rounded-[14px] border p-3"
        >
          <span class="flex items-start gap-1.5 text-[15px] font-medium break-words">
            <span
              v-if="habit.color"
              class="mt-1.5 size-2 shrink-0 rounded-full bg-(--habit)"
              :style="habitColorStyle(habit)"
            ></span>
            <span class="min-w-0">
              <template v-if="habit.emoji">{{ habit.emoji }}&nbsp;</template>
              {{ habit.title }}
            </span>
          </span>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="key in habit.months"
              :key="key"
              class="h-8 rounded-full border px-3 text-[13px]"
              :class="
                key === store.currentMonthKey
                  ? 'border-ink bg-ink text-bg'
                  : 'border-line2 hover:bg-soft'
              "
              :aria-label="t('search.openMonth', { month: monthKeyLabel(key) })"
              @click="openMonth(key)"
            >
              {{ monthShortLabel(key) }} {{ key.slice(0, 4) }}
            </button>
          </div>
        </div>
      </section>

      <!-- Заметки: новые первыми -->
      <section v-if="results.notes.length" class="flex flex-col gap-2">
        <h3 class="text-muted text-xs font-semibold tracking-wider uppercase">
          {{ t('search.notes') }}
        </h3>
        <button
          v-for="note in results.notes"
          :key="`${note.key}-${note.taskId}-${note.day}`"
          class="bg-soft hover:bg-line flex flex-col gap-1 rounded-xl px-3 py-2.5 text-start"
          @click="openNote(note)"
        >
          <span class="text-muted flex gap-2 text-xs">
            <span class="shrink-0">
              {{ dayDateLabel(note.key, note.day) }} {{ note.key.slice(0, 4) }}
            </span>
            <span class="truncate">
              {{ note.emoji ? `${note.emoji} ${note.title}` : note.title }}
            </span>
          </span>
          <span class="line-clamp-3 text-sm break-words">{{ note.text }}</span>
        </button>
      </section>
    </div>
  </Sheet>
</template>
