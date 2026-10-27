<script setup>
  import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';

  defineProps({
    /** Подпись окна для скринридеров */
    label: { type: String, required: true },
    /** Ширина карточки на десктопе: md – 480px, lg – 600px */
    width: { type: String, default: 'md' },
  });

  const emit = defineEmits([
    /** Закрытие по фону или Escape */
    'close',
  ]);

  const card = ref(null);

  /** Элемент, на котором был фокус до открытия: после закрытия фокус возвращается туда */
  let previousFocus = null;

  const focusables = () =>
    [
      ...card.value.querySelectorAll(
        'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ),
    ].filter(el => el.offsetParent !== null);

  /** Escape закрывает окно, Tab ходит по кругу внутри карточки */
  const handleKeydown = event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      emit('close');
      return;
    }
    if (event.key !== 'Tab') return;
    const list = focusables();
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  onMounted(async () => {
    previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    await nextTick();
    (card.value.querySelector('[autofocus]') || card.value).focus();
  });

  onBeforeUnmount(() => {
    document.body.style.overflow = '';
    previousFocus?.focus?.();
  });
</script>

<template>
  <teleport to="body">
    <div
      class="hide-print bg-scrim fixed inset-0 z-50 flex items-end justify-center pt-10 md:items-center md:p-8"
      @click.self="emit('close')"
      @keydown="handleKeydown"
    >
      <div
        ref="card"
        role="dialog"
        aria-modal="true"
        :aria-label="label"
        tabindex="-1"
        class="bg-surface text-ink flex max-h-full w-full flex-col overflow-auto rounded-t-3xl shadow-[0_24px_60px_rgba(0,0,0,.25)] outline-none md:rounded-[20px]"
        :class="width === 'lg' ? 'md:max-w-[600px]' : 'md:max-w-[480px]'"
      >
        <!-- Ручка шторки на телефоне -->
        <div class="flex justify-center pt-2 md:hidden">
          <span class="bg-line2 h-[5px] w-9 rounded-full"></span>
        </div>
        <slot />
      </div>
    </div>
  </teleport>
</template>
