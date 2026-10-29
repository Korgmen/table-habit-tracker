<script setup>
  import { ref, computed, watch, nextTick, onMounted } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { resolveLang } from '@/i18n';
  import { taskStreak, dayTotals } from '@/utils/habitMath';
  import { Ellipsis, Plus, Undo2, Redo2, NotebookPen } from 'lucide-vue-next';
  import MonthNav from '@/components/MonthNav.vue';
  import ArchiveBanner from '@/components/ArchiveBanner.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import MarkCircle from '@/components/MarkCircle.vue';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const {
    monthDays,
    isFuture,
    todayDay,
    isCurrentMonth,
    weekdayLabel,
    currentMonthLabel,
    habitColorStyle,
  } = useHabitUtils();
  const { t } = useI18n();
  const { openNewHabit, openHabit, openNote, undoLast, redoLast } = useModals(t);

  /** Выбранный день: по умолчанию сегодня или последний день архивного месяца */
  const selected = ref(store.today);
  const strip = ref(null);

  /** Прокручивает ленту к выбранному дню (scrollIntoView учитывает RTL) */
  const scrollToSelected = async () => {
    await nextTick();
    strip.value
      ?.querySelector(`[data-day="${selected.value}"]`)
      ?.scrollIntoView({ inline: 'center', block: 'nearest' });
  };

  /** Новый месяц или первая привычка (лента появляется) */
  watch(
    () => [store.currentMonthKey, store.tasks.length > 0],
    () => {
      selected.value = store.today;
      scrollToSelected();
    }
  );
  watch(
    () => store.today,
    value => {
      if (selected.value > value) selected.value = value;
    }
  );
  /** Смена языка может перевернуть направление ленты (RTL) и сбросить прокрутку */
  watch(() => store.lang, scrollToSelected);
  onMounted(scrollToSelected);

  const index = computed(() => selected.value - 1);

  /** Заголовок выбранного дня: «Сегодня, четверг, 14 мая» */
  const dayTitle = computed(() => {
    const date = new Date(store.currentYear, store.currentMonth, selected.value);
    const label = date.toLocaleDateString(resolveLang(store.lang), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    if (selected.value === todayDay.value) return `${t('list.today')}, ${label}`;
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  /** Выполнено из учитываемых отметок за выбранный день (без пропусков и пауз) */
  const dayStats = computed(() => dayTotals(store.tasks, index.value));

  /** Подпись под названием привычки: пропуск, пауза, серия и процент */
  const meta = task => {
    const marks = task.subtasks.map(subtask => subtask.marks[index.value]);
    if (marks.every(mark => mark === false)) return { muted: true, text: t('list.skipped') };
    const parts = [];
    if (task.paused) parts.push(t('list.paused'));
    const streak = taskStreak(task, store.monthCtx, index.value);
    if (streak.unit === 'week' && streak.count > 0) {
      parts.push(t('list.streakWeeks', { count: streak.count }));
    } else if (streak.count > 1) {
      parts.push(t('list.streak', { count: streak.count }));
    }
    parts.push(
      t('list.monthPct', {
        pct: Math.round(parseFloat(task.progress) || 0),
        month: currentMonthLabel.value,
      })
    );
    if (marks.length > 1) {
      parts.push(
        t('list.ofSubs', { done: marks.filter(mark => mark === true).length, total: marks.length })
      );
    }
    return { muted: !!task.paused, text: parts.join(' · ') };
  };

  /** Подписи строк по id привычки: пересчитываются при смене данных или выбранного дня */
  const metas = computed(() => Object.fromEntries(store.tasks.map(task => [task.id, meta(task)])));

  const markState = mark =>
    t(mark === true ? 'mark.done' : mark === false ? 'mark.skip' : 'mark.notDone');
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden">
    <!-- Шапка: месяц и настройки -->
    <div class="flex items-center justify-between px-2 pt-[max(env(safe-area-inset-top),8px)] pb-1">
      <MonthNav compact />
      <button
        class="border-line bg-surface me-1 flex size-11 items-center justify-center rounded-full border"
        :aria-label="t('settings.title')"
        @click="modalStore.showModal('settings')"
      >
        <Ellipsis class="size-5" />
      </button>
    </div>

    <ArchiveBanner v-if="!isCurrentMonth" compact class="mx-4 mt-1 mb-2" />

    <template v-if="store.tasks.length > 0">
      <!-- Лента дней -->
      <div
        ref="strip"
        class="border-line flex shrink-0 gap-0.5 overflow-x-auto border-b px-3 pt-0.5 pb-2.5 [scrollbar-width:none]"
      >
        <button
          v-for="day in monthDays"
          :key="day"
          :data-day="day"
          class="flex h-[62px] w-[46px] shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] disabled:opacity-35"
          :class="
            day === selected ? 'bg-ink text-bg' : day === todayDay ? 'text-accent' : 'text-ink'
          "
          :disabled="isFuture(day)"
          :aria-pressed="day === selected"
          @click="selected = day"
        >
          <span class="text-[11px] opacity-80">{{ weekdayLabel(day) }}</span>
          <span class="text-[17px] font-semibold">{{ day }}</span>
          <span
            class="size-1 rounded-full"
            :class="day === todayDay ? (day === selected ? 'bg-bg' : 'bg-accent') : ''"
          ></span>
        </button>
      </div>

      <!-- Отметки за выбранный день -->
      <div class="flex-1 overflow-auto">
        <div class="flex items-end gap-2 px-4 pt-4 pb-2.5">
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-[17px] font-semibold">{{ dayTitle }}</span>
            <span class="text-muted text-[13px]">
              {{
                t('list.stat', {
                  month: currentMonthLabel,
                  avg: store.overallProgress,
                  grade: store.overallGrade,
                })
              }}
            </span>
          </div>
          <!-- Отмена и повтор: в шапке телефона нет места рядом с месяцем -->
          <div class="flex shrink-0 items-center self-center">
            <button
              class="disabled:text-line2 flex size-10 items-center justify-center"
              :disabled="!store.canUndo"
              :aria-label="t('history.undo')"
              @click="undoLast"
            >
              <Undo2 class="size-5 rtl:-scale-x-100" />
            </button>
            <button
              class="disabled:text-line2 flex size-10 items-center justify-center"
              :disabled="!store.canRedo"
              :aria-label="t('history.redo')"
              @click="redoLast"
            >
              <Redo2 class="size-5 rtl:-scale-x-100" />
            </button>
          </div>
          <!-- flex убирает пробел между числами, который prettier оставляет переносом строки -->
          <span class="flex shrink-0 items-baseline text-[22px] font-bold tracking-tight">
            <span>{{ dayStats.done }}</span>
            <span class="text-muted font-medium">/{{ dayStats.total }}</span>
          </span>
        </div>

        <div
          v-for="task in store.tasks"
          :key="task.id"
          class="border-line flex min-h-[60px] items-center border-b pe-2"
        >
          <button
            class="flex min-w-0 flex-1 flex-col justify-center gap-0.5 self-stretch py-2 ps-4 pe-2 text-start"
            @click="openHabit(task.id, selected)"
          >
            <span
              class="flex items-start gap-1.5 text-[15px] leading-tight font-medium break-words"
              :class="metas[task.id].muted ? 'text-muted' : 'text-ink'"
            >
              <span
                v-if="task.color"
                class="mt-1.5 size-2 shrink-0 rounded-full bg-(--habit)"
                :style="habitColorStyle(task)"
              ></span>
              <span class="min-w-0">
                <template v-if="task.emoji">{{ task.emoji }}&nbsp;</template>
                {{ task.title }}
              </span>
            </span>
            <span class="text-muted text-xs">{{ metas[task.id].text }}</span>
            <span
              v-if="task.notes?.[index]"
              class="text-muted line-clamp-2 text-xs break-words italic"
            >
              {{ task.notes[index] }}
            </span>
          </button>
          <button
            class="flex size-11 shrink-0 items-center justify-center"
            :class="task.notes?.[index] ? 'text-accent' : 'text-line2'"
            :aria-label="t('note.open', { title: task.title, day: selected })"
            @click="openNote(task.id, selected)"
          >
            <NotebookPen class="size-[18px]" />
          </button>
          <div class="flex max-w-44 flex-wrap justify-end">
            <button
              v-for="(subtask, subIndex) in task.subtasks"
              :key="subtask.id"
              class="flex size-11 touch-manipulation items-center justify-center"
              :aria-label="
                t('mark.cell', {
                  title: task.title,
                  day: selected,
                  subtask: subIndex + 1,
                  state: markState(subtask.marks[index]),
                })
              "
              @click="store.cycleMark(task.id, subtask.id, index)"
            >
              <MarkCircle :mark="subtask.marks[index]" size="md" :color="task.color" />
            </button>
          </div>
        </div>

        <!-- Новая привычка: в конце списка, прокручивается вместе с ним -->
        <div class="px-4 pt-4">
          <button
            class="bg-ink text-bg flex h-[52px] w-full items-center justify-center gap-1.5 rounded-[14px] text-base font-semibold"
            @click="openNewHabit"
          >
            <Plus class="size-5" :stroke-width="2.5" />
            {{ t('header.newHabitLong') }}
          </button>
        </div>

        <p
          class="text-muted px-4 pt-3.5 pb-[max(env(safe-area-inset-bottom),24px)] text-xs leading-normal text-pretty"
        >
          {{ t('list.hint') }}
        </p>
      </div>
    </template>

    <EmptyState v-else />
  </div>
</template>
