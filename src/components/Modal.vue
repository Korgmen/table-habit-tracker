<script setup>
  import { watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';
  import { X } from 'lucide-vue-next';

  const modalStore = useModalStore();
  const { currentTheme } = useHabitUtils();
  const { t } = useI18n();

  /** Массив всех фокусируемых элементов внутри модального окна */
  let focusableElements = [];
  let firstFocusable = null;
  let lastFocusable = null;

  /** Вызывает обработчик и закрывает окно, если обработчик не открыл вместо него новое */
  const runAndClose = handler => {
    const modal = modalStore.modal;
    handler?.();
    if (modalStore.modal === modal) modalStore.closeModal();
  };

  /** Обрабатывает подтверждение действия в модальном окне */
  const handleConfirm = () => runAndClose(modalStore.modal.onConfirm);

  /** Обрабатывает отмену действия в модальном окне */
  const handleCancel = () => runAndClose(modalStore.modal.onCancel);

  /** Закрытие крестиком или Escape вызывает onDismiss или, если его нет, onCancel */
  const handleDismiss = () => runAndClose(modalStore.modal.onDismiss ?? modalStore.modal.onCancel);

  /**
   * Обрабатывает нажатия клавиш внутри модального окна.
   * - Escape — закрытие
   * - Tab — циклический переход между элементами
   */
  const handleKeydown = event => {
    if (!modalStore.modal.isOpen) return;

    if (event.key === 'Escape') {
      handleDismiss();
      return;
    }

    if (event.key === 'Tab') {
      if (focusableElements.length === 0) return;

      const isShift = event.shiftKey;
      const active = document.activeElement;

      if (isShift && active === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!isShift && active === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  };

  /** Настраивает ловушку фокуса внутри открытого модального окна */
  const setupFocusTrap = async () => {
    await nextTick();
    const modal = document.querySelector('.modal-container');
    if (!modal) return;

    focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable = focusableElements[0];
    lastFocusable = focusableElements[focusableElements.length - 1];

    if (firstFocusable) firstFocusable.focus();
  };

  /**
   * Отслеживает открытие, закрытие и смену окна из очереди и управляет:
   * - фокусом,
   * - обработчиком клавиш,
   * - блокировкой прокрутки страницы.
   */
  watch(
    () => modalStore.modal,
    modal => {
      if (modal.isOpen) {
        setupFocusTrap();
        document.addEventListener('keydown', handleKeydown);
        document.body.style.overflow = 'hidden';
      } else {
        document.removeEventListener('keydown', handleKeydown);
        document.body.style.overflow = '';
      }
    }
  );

  /** Инициализация ловушки фокуса при монтировании (на случай, если модал уже открыт) */
  onMounted(() => {
    if (modalStore.modal.isOpen) setupFocusTrap();
  });

  /** Очистка обработчиков и стилей перед размонтированием */
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.body.style.overflow = '';
  });
</script>

<template>
  <teleport to="body">
    <!-- Фон и анимация появления модального окна -->
    <transition name="fade">
      <div
        v-if="modalStore.modal.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="modalStore.modal.title"
      >
        <!-- Контейнер модального окна -->
        <div
          class="modal-container relative w-full border-3 p-6 shadow-xl"
          :class="{
            'bg-[#292929] text-[#FFF8F0]': currentTheme === 'dark',
            'bg-white text-[#12130F]': currentTheme === 'light',
            'max-w-md': modalStore.modal.type !== 'custom',
            'flex max-h-[90dvh] max-w-2xl flex-col': modalStore.modal.type === 'custom',
          }"
        >
          <!-- Кнопка закрытия -->
          <button
            class="tap-highlight-transparent absolute end-0 top-0 w-fit cursor-pointer touch-manipulation p-2"
            :aria-label="t('settings.close')"
            @click="handleDismiss"
          >
            <X class="h-5 w-5" />
          </button>

          <!-- Заголовок -->
          <h3 class="mb-4 text-xl font-semibold">{{ modalStore.modal.title }}</h3>

          <!-- Сообщение -->
          <div
            v-if="modalStore.modal.html"
            class="mb-6 flex flex-col gap-1.5 text-base"
            :class="{
              'overflow-y-auto': modalStore.modal.type === 'custom',
            }"
            v-html="modalStore.modal.html"
          ></div>
          <p
            v-else
            class="mb-6 text-base"
            :class="{
              'overflow-y-auto': modalStore.modal.type === 'custom',
            }"
          >
            {{ modalStore.modal.message }}
          </p>

          <!-- Пользовательский контент (для типа custom) -->
          <div v-if="modalStore.modal.type === 'custom'">
            <slot></slot>
          </div>

          <!-- Кнопки действий -->
          <div class="flex justify-end gap-3">
            <button
              v-if="modalStore.modal.type === 'confirm'"
              class="tap-highlight-transparent flex h-8 w-fit cursor-pointer touch-manipulation items-center justify-center self-start border-2 px-3 py-1.5 font-semibold"
              @click="handleCancel"
            >
              {{ modalStore.modal.cancelText || t('modal.cancel') }}
            </button>
            <button
              class="tap-highlight-transparent flex h-8 w-fit cursor-pointer touch-manipulation items-center justify-center self-start border-2 px-3 py-1.5 font-semibold"
              @click="handleConfirm"
            >
              {{
                modalStore.modal.type === 'confirm'
                  ? modalStore.modal.confirmText || t('modal.confirm')
                  : t('modal.ok')
              }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
