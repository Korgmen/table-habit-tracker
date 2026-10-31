<script setup>
  import { ref, computed, watch, nextTick, onMounted } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { intlLocale } from '@/i18n';
  import { dayTotals } from '@/utils/habitMath';
  import { currentStreak } from '@/utils/stats';
  import { monthKey } from '@/utils/archive';
  import { useSearch } from '@/composables/useSearch';
  import { useLongPress, useSwipe, haptic } from '@/composables/useGestures';
  import {
    Ellipsis,
    Plus,
    Undo2,
    Redo2,
    NotebookPen,
    Search,
    X,
    ChartColumn,
    CheckCheck,
    Eraser,
    CalendarClock,
  } from 'lucide-vue-next';
  import MonthNav from '@/components/MonthNav.vue';
  import AppLogo from '@/components/AppLogo.vue';
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
    canNextMonth,
    starsText,
  } = useHabitUtils();
  const { t } = useI18n();
  const {
    openNewHabit,
    openHabit,
    openNote,
    openStats,
    openSearch,
    undoLast,
    redoLast,
    toastWithUndo,
  } = useModals(t);
  const { query, filteredTasks, isFiltering, clearSearch } = useSearch();

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

  /** День, который нужно выбрать после перехода в другой месяц (вчера в прошлом месяце) */
  let pendingDay = null;

  /**
   * Новый месяц или первая привычка (лента появляется). Источники – отдельные геттеры,
   * Vue сравнивает их значения: замена списка в том же месяце (отмена, облако) выбор дня не трогает.
   */
  watch([() => store.currentMonthKey, () => store.tasks.length > 0], () => {
    selected.value = Math.min(pendingDay ?? store.today, store.today);
    pendingDay = null;
    scrollToSelected();
  });
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

  /** Выбирает число day месяца key, при необходимости открывая месяц */
  const showDay = (key, day) => {
    if (key === store.currentMonthKey) {
      selected.value = Math.min(day, store.today);
      scrollToSelected();
    } else {
      pendingDay = day;
      store.openMonthKey(key);
    }
  };

  /** Вчерашний день: в прошлом месяце, если сегодня первое число */
  const yesterday = computed(() => {
    const date = new Date(
      store.realDate.getFullYear(),
      store.realDate.getMonth(),
      store.realDate.getDate() - 1
    );
    return { key: monthKey(date), day: date.getDate() };
  });

  const isSelected = (key, day) => key === store.currentMonthKey && day === selected.value;

  /**
   * Ближайший к выбранному более ранний день с пустыми отметками, а если такого нет –
   * последний такой день месяца; null, если неотмеченных дней нет
   */
  const unmarkedTarget = computed(() => {
    const days = store.unmarkedDays.filter(day => day !== selected.value);
    return days.filter(day => day < selected.value).at(-1) ?? days.at(-1) ?? null;
  });

  /** У привычек не на паузе в выбранный день есть отметка mark */
  const dayHas = mark =>
    store.tasks.some(
      task =>
        !task.paused && task.subtasks.some(subtask => (subtask.marks[index.value] ?? null) === mark)
    );

  /** Отмечает весь выбранный день выполненным или снимает отметки, тост предлагает отменить */
  const fillDay = done => {
    if (!store.fillDay(index.value, done)) return;
    haptic();
    toastWithUndo(t(done ? 'list.dayFilled' : 'list.dayCleared', { day: selected.value }));
  };

  /** Быстрые переходы и действия над выбранным днём */
  const quickActions = computed(() => {
    const actions = [];
    if (!isSelected(store.realMonthKey, store.realDate.getDate())) {
      actions.push({
        id: 'today',
        label: t('list.goToday'),
        run: () => showDay(store.realMonthKey, store.realDate.getDate()),
      });
    }
    if (!isSelected(yesterday.value.key, yesterday.value.day)) {
      actions.push({
        id: 'yesterday',
        label: t('list.goYesterday'),
        run: () => showDay(yesterday.value.key, yesterday.value.day),
      });
    }
    if (unmarkedTarget.value !== null) {
      actions.push({
        id: 'unmarked',
        icon: CalendarClock,
        label: t(
          'list.goUnmarked',
          { count: store.unmarkedDays.length },
          store.unmarkedDays.length
        ),
        run: () => showDay(store.currentMonthKey, unmarkedTarget.value),
      });
    }
    if (dayHas(null)) {
      actions.push({
        id: 'fill',
        icon: CheckCheck,
        label: t('list.markAll'),
        run: () => fillDay(true),
      });
    }
    if (dayHas(true)) {
      actions.push({
        id: 'clear',
        icon: Eraser,
        label: t('list.clearAll'),
        run: () => fillDay(false),
      });
    }
    return actions;
  });

  /** Свайп по списку меняет день, по шапке – месяц */
  const daySwipe = useSwipe({
    onPrev: () => selected.value > 1 && showDay(store.currentMonthKey, selected.value - 1),
    onNext: () =>
      selected.value < store.today && showDay(store.currentMonthKey, selected.value + 1),
  });
  const monthSwipe = useSwipe({
    onPrev: () => store.prevMonth(),
    onNext: () => canNextMonth.value && store.nextMonth(),
  });

  /** Тап по кружку меняет отметку, долгое нажатие ставит или снимает пропуск */
  const longPress = useLongPress(({ task, subtask }) => {
    store.toggleSkip(task.id, subtask.id, index.value);
    haptic(30);
  });

  const tapMark = (task, subtask) => {
    if (longPress.consumeClick()) return;
    store.cycleMark(task.id, subtask.id, index.value);
    haptic();
  };

  /** Строка поиска: открывается кнопкой в шапке, закрытие сбрасывает фильтр */
  const searchOpen = ref(isFiltering.value);
  const searchField = ref(null);

  const toggleSearch = async () => {
    if (searchOpen.value) {
      clearSearch();
      searchOpen.value = false;
      return;
    }
    searchOpen.value = true;
    await nextTick();
    searchField.value?.focus();
  };

  /** Итог месяца в строке под датой: средний процент и оценка в выбранном виде */
  const summaryText = computed(() => {
    if (store.summaryKind === 'hidden') return t('stats.open');
    const parts = [
      t('list.statAvg', { month: currentMonthLabel.value, avg: store.overallProgress }),
    ];
    const grade = store.overallGrade;
    if (store.summaryKind === 'stars') parts.push(starsText(grade));
    else if (grade !== null) parts.push(t('summary.grade', { grade }));
    return parts.join(' · ');
  });

  /** Заголовок выбранного дня: «Сегодня, четверг, 14 мая» */
  const dayTitle = computed(() => {
    const date = new Date(store.currentYear, store.currentMonth, selected.value);
    const label = date.toLocaleDateString(intlLocale(store.lang), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    if (selected.value === todayDay.value) return t('list.todayDate', { date: label });
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
    const streak = currentStreak(
      store.archiveView,
      task.title,
      store.statsOptions,
      store.currentMonthKey,
      index.value
    );
    if (streak.unit === 'week' && streak.count > 0) {
      parts.push(t('list.streakWeeks', { count: streak.count }, streak.count));
    } else if (streak.count > 1) {
      parts.push(t('list.streak', { count: streak.count }, streak.count));
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
    <!-- Лого над шапкой: в одной строке с месяцем и кнопками ему не хватает места -->
    <div class="flex px-4 pt-[max(env(safe-area-inset-top),10px)]">
      <AppLogo size="sm" />
    </div>
    <!-- Шапка: месяц, поиск и настройки; свайп по шапке меняет месяц -->
    <div
      class="flex touch-pan-y items-center justify-between px-2 pt-0.5 pb-1"
      @touchstart.passive="monthSwipe.start"
      @touchend="monthSwipe.end"
      @touchcancel="monthSwipe.cancel"
    >
      <MonthNav compact />
      <div class="flex items-center gap-1.5 pe-1">
        <button
          class="border-line flex size-11 items-center justify-center rounded-full border"
          :class="searchOpen ? 'bg-ink text-bg' : 'bg-surface'"
          :aria-label="t('search.open')"
          :aria-expanded="searchOpen"
          @click="toggleSearch"
        >
          <Search class="size-5" />
        </button>
        <button
          class="border-line bg-surface flex size-11 items-center justify-center rounded-full border"
          :aria-label="t('settings.title')"
          @click="modalStore.openModal('settings')"
        >
          <Ellipsis class="size-5" />
        </button>
      </div>
    </div>

    <!-- Поиск: фильтр привычек месяца по названию и заметкам -->
    <div v-if="searchOpen" class="flex items-center gap-2 px-4 pt-1 pb-2">
      <div
        class="border-line2 bg-surface focus-within:border-ink flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border-[1.5px] ps-3 pe-1"
      >
        <Search class="text-muted size-4 shrink-0" />
        <input
          ref="searchField"
          v-model="query"
          type="search"
          enterkeyhint="search"
          :placeholder="t('search.placeholder')"
          :aria-label="t('search.placeholder')"
          class="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
          @keydown.esc="toggleSearch"
        />
        <button
          v-if="query"
          class="text-muted flex size-9 shrink-0 items-center justify-center"
          :aria-label="t('search.clear')"
          @click="clearSearch"
        >
          <X class="size-4" />
        </button>
      </div>
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

      <!-- Отметки за выбранный день; свайп влево-вправо меняет день -->
      <div
        class="flex-1 touch-pan-y overflow-auto"
        @touchstart.passive="daySwipe.start"
        @touchend="daySwipe.end"
        @touchcancel="daySwipe.cancel"
      >
        <div class="flex items-end gap-2 px-4 pt-4 pb-2.5">
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-[17px] font-semibold">{{ dayTitle }}</span>
            <!-- Итог месяца открывает статистику -->
            <button
              class="text-muted flex items-center gap-1 self-start text-start text-[13px] underline-offset-2 hover:underline"
              :aria-label="`${summaryText}. ${t('stats.open')}`"
              @click="openStats"
            >
              <ChartColumn class="size-3.5 shrink-0" />
              <span>{{ summaryText }}</span>
            </button>
          </div>
          <!-- Отмена и повтор: в шапке телефона нет места рядом с месяцем -->
          <div class="flex shrink-0 items-center self-center">
            <button
              class="disabled:text-faint flex size-10 items-center justify-center"
              :disabled="!store.canUndo"
              :aria-label="t('history.undo')"
              @click="undoLast"
            >
              <Undo2 class="size-5 rtl:-scale-x-100" />
            </button>
            <button
              class="disabled:text-faint flex size-10 items-center justify-center"
              :disabled="!store.canRedo"
              :aria-label="t('history.redo')"
              @click="redoLast"
            >
              <Redo2 class="size-5 rtl:-scale-x-100" />
            </button>
          </div>
          <!--
            flex убирает пробел между числами, который prettier оставляет переносом строки;
            dir="ltr": в арабском flex иначе развернёт дробь в «5/0»
          -->
          <span class="flex shrink-0 items-baseline text-[22px] font-bold tracking-tight" dir="ltr">
            <span>{{ dayStats.done }}</span>
            <span class="text-muted font-medium">/{{ dayStats.total }}</span>
          </span>
        </div>

        <!-- Быстрые переходы и действия над днём -->
        <div
          v-if="quickActions.length > 0"
          class="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none]"
          @touchstart.passive.stop
        >
          <button
            v-for="action in quickActions"
            :key="action.id"
            class="border-line2 bg-surface flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] whitespace-nowrap"
            @click="action.run"
          >
            <component :is="action.icon" v-if="action.icon" class="size-4" />
            {{ action.label }}
          </button>
        </div>

        <div
          v-for="task in filteredTasks"
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
              class="flex size-11 touch-manipulation items-center justify-center select-none [-webkit-touch-callout:none]"
              :aria-label="
                t('mark.cell', {
                  title: task.title,
                  day: selected,
                  subtask: subIndex + 1,
                  state: markState(subtask.marks[index]),
                })
              "
              v-on="longPress.bind({ task, subtask })"
              @click="tapMark(task, subtask)"
            >
              <MarkCircle :mark="subtask.marks[index]" size="md" :color="task.color" />
            </button>
          </div>
        </div>

        <!-- Поиск: ничего в месяце или переход к поиску по всем месяцам и заметкам -->
        <div v-if="isFiltering" class="flex flex-col gap-2 px-4 pt-4">
          <span v-if="filteredTasks.length === 0" class="text-muted text-sm">
            {{ t('search.noneMonth') }}
          </span>
          <button
            class="border-line2 hover:bg-soft flex h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm"
            @click="openSearch(query)"
          >
            <Search class="size-4 shrink-0" />
            <span class="truncate">{{ t('search.archive', { query: query.trim() }) }}</span>
          </button>
        </div>

        <!-- Новая привычка: в конце списка, прокручивается вместе с ним -->
        <div v-else class="px-4 pt-4">
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
