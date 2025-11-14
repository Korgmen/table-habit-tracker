<script setup>
  import { computed, ref } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';

  const props = defineProps({
    /** Номер дня в текущем месяце */
    day: {
      type: Number,
      required: true,
    },
    /** Является ли текущий день концом недели */
    isEndOfWeek: {
      type: Function,
      required: true,
    },
  });

  const store = useHabitStore();

  /** Таймер и состояние для двойного тапа */
  const tapState = ref(new Map());
  const DOUBLE_TAP_DELAY = 250;

  /** Состояние кружка в заголовке: `future` – день ещё не наступил, `completed` – прошёл */
  const getHeaderCircleState = computed(() => {
    if (props.day > store.today) return 'future';
    return 'completed';
  });

  /** Все подзадачи в колонке помечены как пропущенные (false) */
  const isAllFalse = computed(
    () =>
      store.tasks.length > 0 &&
      store.tasks.every(t => t.subtasks.every(s => s.marks[props.day - 1] === false))
  );

  /**
   * Обрабатывает тапы по кружку дня в шапке таблицы на мобильных.
   * Одиночный тап — очищает колонку (null), двойной тап — пропускает день (false).
   * Аналогично десктопу: левый клик → null, правый клик → false.
   */
  const handleHeaderTap = event => {
    const dayIndex = props.day - 1;
    if (dayIndex >= store.today) return;

    const key = `header-${props.day}`;
    const now = Date.now();

    let state = tapState.value.get(key) || { lastTap: 0, timeout: null };

    if (state.timeout) {
      clearTimeout(state.timeout);
      state.timeout = null;
    }

    const timeDiff = now - state.lastTap;

    if (timeDiff > 0 && timeDiff < DOUBLE_TAP_DELAY) {
      store.updateHeaderDay(dayIndex, false);
      tapState.value.delete(key);
    } else {
      state.lastTap = now;
      state.timeout = setTimeout(() => {
        store.updateHeaderDay(dayIndex, null);
        tapState.value.delete(key);
      }, DOUBLE_TAP_DELAY);
      tapState.value.set(key, state);
    }

    event.preventDefault();
  };
</script>

<template>
  <div
    class="flex w-5 flex-col items-center gap-[5px] transition-all duration-300 ease-in-out"
    :class="{ 'opacity-50': getHeaderCircleState === 'future' }"
  >
    <p class="text-sm leading-none font-medium md:text-lg print:text-lg">{{ day }}</p>

    <div
      class="tap-highlight-transparent relative flex aspect-square w-9/10 touch-manipulation items-center justify-center rounded-[50%] border-2 border-current transition-all duration-300 ease-in-out before:absolute before:h-0.5 before:w-full before:rotate-45 before:bg-current before:opacity-0 before:transition-all before:duration-300 before:ease-in-out after:absolute after:h-0.5 after:w-full after:-rotate-45 after:bg-current after:opacity-0 after:transition-all after:duration-300 after:ease-in-out md:w-3 print:w-3"
      :class="{
        'cursor-not-allowed': getHeaderCircleState === 'future',
        'cursor-pointer bg-current': getHeaderCircleState === 'completed',
        'bg-transparent before:opacity-100 after:opacity-100': isAllFalse,
      }"
      @click.left.prevent="
        if (props.day - 1 < store.today) store.updateHeaderDay(props.day - 1, null);
      "
      @click.right.prevent="
        if (props.day - 1 < store.today) store.updateHeaderDay(props.day - 1, false);
      "
      @touchend.prevent="handleHeaderTap"
    ></div>
  </div>

  <div
    v-if="props.isEndOfWeek(props.day)"
    class="h-3 border-1 bg-current md:h-4 print:h-4"
    :class="{ 'opacity-50': getHeaderCircleState === 'future' }"
  ></div>
</template>
