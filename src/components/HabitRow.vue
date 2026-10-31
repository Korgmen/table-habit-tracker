<script setup>
  import { computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { GripVertical } from 'lucide-vue-next';
  import MarkCircle from '@/components/MarkCircle.vue';

  /**
   * Строка привычки в таблице. Отдельный компонент: клик по отметке перерисовывает только эту
   * строку, а не всю таблицу (до 20 строк × 31 день × 8 отметок).
   */
  const props = defineProps({
    task: { type: Object, required: true },
    /** Номер первой строки отметок привычки в таблице: для навигации стрелками (data-row) */
    rowStart: { type: Number, required: true },
    /** Числа месяца и классы колонок по дням (разделитель недели, сегодня) */
    days: { type: Array, required: true },
    columns: { type: Array, required: true },
    /** Последнее число, которое можно отмечать */
    today: { type: Number, required: true },
    /** Список отфильтрован поиском: перетаскивание выключено */
    filtering: Boolean,
    /** Вторая строка под названием и подпись серии */
    meta: { type: String, default: '' },
    streak: { type: String, default: '' },
  });

  const store = useHabitStore();
  const { habitColorStyle } = useHabitUtils();
  const { t } = useI18n();
  const { openHabit, openNote } = useModals(t);

  const isFuture = day => day > props.today;

  /** Слова состояния отметки переводятся один раз на строку и общие для всех её клеток */
  const stateWords = computed(() => ({
    true: t('mark.done'),
    false: t('mark.skip'),
    null: t('mark.notDone'),
  }));

  const cellLabel = (subIndex, day) =>
    t('mark.cell', {
      title: props.task.title,
      day,
      subtask: subIndex + 1,
      state: stateWords.value[props.task.subtasks[subIndex].marks[day - 1] ?? null],
    });

  /** Клик по отметке меняет её, Alt+клик открывает заметку к дню */
  const clickMark = (event, subtask, day) => {
    if (isFuture(day)) return;
    if (event.altKey) openNote(props.task.id, day);
    else store.cycleMark(props.task.id, subtask.id, day - 1);
  };

  const toggleSkip = (subtask, day) => {
    if (!isFuture(day)) store.toggleSkip(props.task.id, subtask.id, day - 1);
  };
</script>

<template>
  <div class="border-line flex border-b" role="row">
    <div
      class="border-line bg-bg sticky start-0 z-[2] flex w-[220px] shrink-0 items-center gap-1.5 border-e ps-2 pe-1.5"
      role="rowheader"
    >
      <span
        v-if="!filtering"
        class="drag-handle hide-print text-line2 hover:text-muted flex w-4 cursor-grab items-center justify-center"
        :title="t('grid.drag')"
        aria-hidden="true"
      >
        <GripVertical class="size-4" />
      </span>
      <span v-else class="w-4 shrink-0"></span>
      <button
        class="hover:bg-soft flex min-w-0 flex-1 flex-col gap-px rounded-md px-1 py-1.5 text-start"
        :title="t('grid.edit')"
        tabindex="-1"
        :data-row="rowStart"
        data-col="0"
        @click="openHabit(task.id)"
      >
        <span
          class="flex items-start gap-1.5 text-sm leading-tight font-medium break-words"
          :class="task.paused ? 'text-muted' : ''"
        >
          <span
            v-if="task.color"
            class="mt-1 size-2 shrink-0 rounded-full bg-(--habit)"
            :style="habitColorStyle(task)"
          ></span>
          <span class="min-w-0">
            <template v-if="task.emoji">{{ task.emoji }}&nbsp;</template>
            {{ task.title }}
          </span>
        </span>
        <span v-if="meta" class="text-muted text-[11px]">{{ meta }}</span>
      </button>
    </div>

    <div
      v-for="day in days"
      :key="day"
      class="relative flex w-7 shrink-0 flex-col justify-center border-s py-0.5 pointer-coarse:w-10"
      :class="columns[day - 1]"
      role="gridcell"
    >
      <!-- Заметка к дню: точка в углу клетки, текст в подсказке -->
      <button
        v-if="task.notes?.[day - 1]"
        class="hide-print absolute end-0 top-0 z-[1] flex size-3 items-center justify-center"
        tabindex="-1"
        :title="task.notes[day - 1]"
        :aria-label="t('note.open', { title: task.title, day })"
        @click="openNote(task.id, day)"
      >
        <span class="bg-accent size-1.5 rounded-full"></span>
      </button>
      <button
        v-for="(subtask, index) in task.subtasks"
        :key="subtask.id"
        class="flex w-full items-center justify-center disabled:cursor-default"
        :class="task.subtasks.length > 1 ? 'h-8 pointer-coarse:h-10' : 'h-10 pointer-coarse:h-11'"
        tabindex="-1"
        :data-row="rowStart + index"
        :data-col="day"
        :data-task="task.id"
        :data-sub="subtask.id"
        :disabled="isFuture(day)"
        :aria-label="cellLabel(index, day)"
        @click="clickMark($event, subtask, day)"
        @contextmenu.prevent="toggleSkip(subtask, day)"
      >
        <MarkCircle :mark="subtask.marks[day - 1]" :future="isFuture(day)" :color="task.color" />
      </button>
    </div>

    <div class="flex w-[110px] shrink-0 flex-col justify-center gap-[5px] px-4" role="gridcell">
      <span class="text-[13px] font-semibold" :class="task.paused ? 'text-muted' : ''">
        {{ task.progress }}%
      </span>
      <span class="bg-line flex h-1 rounded-full" aria-hidden="true">
        <span
          class="rounded-full"
          :class="task.color ? 'bg-(--habit)' : 'bg-ink'"
          :style="{
            ...habitColorStyle(task),
            width: `${Math.min(100, parseFloat(task.progress) || 0)}%`,
          }"
        ></span>
      </span>
      <span v-if="streak" class="text-muted text-[11px] leading-none">{{ streak }}</span>
    </div>
  </div>
</template>
