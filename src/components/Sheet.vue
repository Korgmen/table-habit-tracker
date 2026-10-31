<script>
  /** Открытых окон: прокрутка страницы под ними выключена, пока закрыты не все */
  let openSheets = 0;

  const lockScroll = delta => {
    openSheets = Math.max(openSheets + delta, 0);
    document.body.style.overflow = openSheets > 0 ? 'hidden' : '';
  };
</script>

<script setup>
  import { ref, computed, inject, onMounted, onBeforeUnmount, nextTick } from 'vue';
  import { useModalStore } from '@/stores/modalStore';
  import { MODAL_ID } from '@/composables/useModals';

  defineProps({
    /** Подпись окна для скринридеров */
    label: { type: String, required: true },
    /** Ширина карточки на десктопе: md – 480px, lg – 600px */
    width: { type: String, default: 'md' },
    /** Экран целиком (проверка отметок с фото) вместо карточки над затемнением */
    full: Boolean,
  });

  const emit = defineEmits([
    /** Закрытие по фону или Escape */
    'close',
  ]);

  const modalStore = useModalStore();
  const modalId = inject(MODAL_ID, null);

  /** Окно под другим окном недоступно для фокуса и скринридера, пока верхнее не закроется */
  const covered = computed(() => modalId !== null && modalStore.top?.id !== modalId);

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
    lockScroll(1);
    await nextTick();
    (card.value.querySelector('[autofocus]') || card.value).focus();
  });

  onBeforeUnmount(() => {
    lockScroll(-1);
    /** Окно под этим снимает inert при следующей отрисовке: фокус возвращается после неё */
    const target = previousFocus;
    nextTick(() => target?.focus?.());
  });
</script>

<template>
  <teleport to="body">
    <div
      class="hide-print fixed inset-0 z-50"
      :class="
        full
          ? 'bg-bg overflow-y-auto'
          : 'bg-scrim flex items-end justify-center pt-10 md:items-center md:p-8'
      "
      :inert="covered || undefined"
      @click.self="emit('close')"
      @keydown="handleKeydown"
    >
      <div
        ref="card"
        role="dialog"
        aria-modal="true"
        :aria-label="label"
        tabindex="-1"
        class="text-ink outline-none"
        :class="
          full
            ? 'bg-bg min-h-full w-full'
            : [
                'bg-surface flex max-h-full w-full flex-col overflow-auto rounded-t-3xl shadow-[0_24px_60px_rgba(0,0,0,.25)] md:rounded-[20px]',
                width === 'lg' ? 'md:max-w-[600px]' : 'md:max-w-[480px]',
              ]
        "
      >
        <!-- Ручка шторки на телефоне -->
        <div v-if="!full" class="flex justify-center pt-2 md:hidden">
          <span class="bg-line2 h-[5px] w-9 rounded-full"></span>
        </div>
        <slot />
      </div>
    </div>
  </teleport>
</template>
