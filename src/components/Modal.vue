<script setup>
  import { watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';
  import { X } from 'lucide-vue-next';

  const store = useHabitStore();
  const { currentTheme } = useHabitUtils();
  const { t } = useI18n();

  /** Массив всех фокусируемых элементов внутри модального окна */
  let focusableElements = [];
  let firstFocusable = null;
  let lastFocusable = null;

  /** Обрабатывает подтверждение действия в модальном окне */
  const handleConfirm = () => {
    if (store.modal.onConfirm) store.modal.onConfirm();
    store.closeModal();
  };

  /** Обрабатывает отмену действия в модальном окне */
  const handleCancel = () => {
    if (store.modal.onCancel) store.modal.onCancel();
    store.closeModal();
  };

  /**
   * Обрабатывает нажатия клавиш внутри модального окна.
   * - Escape — закрытие
   * - Tab — циклический переход между элементами
   */
  const handleKeydown = event => {
    if (!store.modal.isOpen) return;

    if (event.key === 'Escape') {
      store.closeModal();
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
   * Отслеживает открытие/закрытие модального окна и управляет:
   * - фокусом,
   * - обработчиком клавиш,
   * - блокировкой прокрутки страницы.
   */
  watch(
    () => store.modal.isOpen,
    isOpen => {
      if (isOpen) {
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
    if (store.modal.isOpen) setupFocusTrap();
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
        v-if="store.modal.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="store.modal.title"
        @keydown="handleKeydown"
      >
        <!-- Контейнер модального окна -->
        <div
          class="modal-container relative w-full max-w-md border-3 p-6 shadow-xl"
          :class="
            currentTheme === 'dark' ? 'bg-[#292929] text-[#FFF8F0]' : 'bg-white text-[#12130F]'
          "
        >
          <!-- Кнопка закрытия -->
          <button
            class="absolute top-0 right-0 w-fit cursor-pointer p-2"
            :aria-label="t('settings.close')"
            @click="store.closeModal"
          >
            <X class="h-5 w-5" />
          </button>

          <!-- Заголовок -->
          <h3 class="mb-4 text-xl font-semibold">{{ store.modal.title }}</h3>

          <!-- Сообщение -->
          <p class="mb-6 text-base">{{ store.modal.message }}</p>

          <!-- Пользовательский контент (для типа custom) -->
          <div v-if="store.modal.type === 'custom'">
            <slot></slot>
          </div>

          <!-- Кнопки действий -->
          <div class="flex justify-end gap-3">
            <button
              v-if="store.modal.type === 'confirm'"
              class="flex h-8 w-fit cursor-pointer items-center justify-center self-start border-2 px-3 py-1.5 font-semibold"
              @click="handleCancel"
            >
              {{ t('modal.cancel') }}
            </button>
            <button
              class="flex h-8 w-fit cursor-pointer items-center justify-center self-start border-2 px-3 py-1.5 font-semibold"
              @click="handleConfirm"
            >
              {{ store.modal.type === 'confirm' ? t('modal.confirm') : t('modal.ok') }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
