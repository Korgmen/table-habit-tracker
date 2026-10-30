import { ref, computed } from 'vue';
import { useHabitStore } from '@/stores/habitStore';
import { searchText, taskMatches } from '@/utils/stats';

/** Запрос фильтра привычек открытого месяца: один на таблицу, список дня и шапку */
const query = ref('');
/** Поле поиска в шапке десктопа: горячая клавиша / ставит в него фокус */
const searchInput = ref(null);

export function useSearch() {
  const store = useHabitStore();

  const normalized = computed(() => searchText(query.value));

  /** Привычки открытого месяца под запрос: название, эмодзи или заметки */
  const filteredTasks = computed(() =>
    normalized.value ? store.tasks.filter(task => taskMatches(task, normalized.value)) : store.tasks
  );

  const isFiltering = computed(() => normalized.value.length > 0);

  const clearSearch = () => {
    query.value = '';
  };

  return { query, searchInput, filteredTasks, isFiltering, clearSearch };
}
