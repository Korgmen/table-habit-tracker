<script setup>
  import { computed } from 'vue';
  import { Check, X } from 'lucide-vue-next';

  const props = defineProps({
    /** Отметка: true выполнено, false пропуск, null пусто */
    mark: { type: [Boolean, null], default: null },
    /** sm – ячейка таблицы, md – список дня, lg – календарь в окне привычки */
    size: { type: String, default: 'sm' },
    /** День ещё не наступил */
    future: Boolean,
    /** Сегодняшний день (только для календаря) */
    today: Boolean,
    /** Число внутри кружка (календарь) */
    label: { type: [String, Number], default: null },
  });

  const sizeClass = { sm: 'size-[18px]', md: 'size-[30px]', lg: 'size-[34px] text-[13px]' };
  const iconClass = { sm: 'size-3', md: 'size-4', lg: 'size-4' };

  const stateClass = computed(() => {
    if (props.mark === true) return 'border-2 border-ink bg-ink text-bg';
    if (props.mark === false) return 'border-2 border-dashed border-muted text-muted';
    if (props.future) return 'border-[1.5px] border-dotted border-line2 text-line2';
    if (props.today) return 'border-2 border-accent';
    return props.size === 'lg' ? 'border-[1.5px] border-line' : 'border-2 border-line2';
  });
</script>

<template>
  <span
    class="flex shrink-0 items-center justify-center rounded-full font-semibold transition-colors"
    :class="[sizeClass[size], stateClass]"
    aria-hidden="true"
  >
    <X v-if="mark === false" :class="iconClass[size]" :stroke-width="2.5" />
    <template v-else-if="label !== null">{{ label }}</template>
    <Check v-else-if="mark === true && size === 'md'" :class="iconClass[size]" :stroke-width="3" />
  </span>
</template>
