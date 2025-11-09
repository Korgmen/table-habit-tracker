<!-- src/components/Modal.vue -->
<script setup>
  import { computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
  import { useHabitStore } from '../stores/habitStore';
  import { useI18n } from 'vue-i18n';
  import { X } from 'lucide-vue-next';

  const store = useHabitStore();
  const { t } = useI18n();

  let focusableElements = [];
  let firstFocusable = null;
  let lastFocusable = null;

  const currentTheme = computed(() => {
    if (store.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return store.theme;
  });

  const handleConfirm = () => {
    if (store.modal.onConfirm) store.modal.onConfirm();
    store.closeModal();
  };

  const handleCancel = () => {
    if (store.modal.onCancel) store.modal.onCancel();
    store.closeModal();
  };

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

  onMounted(() => {
    if (store.modal.isOpen) setupFocusTrap();
  });

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.body.style.overflow = '';
  });
</script>

<template>
  <teleport to="body">
    <transition name="fade">
      <div
        v-if="store.modal.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="store.modal.title"
        @keydown="handleKeydown"
      >
        <div
          class="modal-container relative w-full max-w-md border-3 p-6 shadow-xl"
          :class="
            currentTheme === 'dark' ? 'bg-[#292929] text-[#FFF8F0]' : 'bg-white text-[#12130F]'
          "
        >
          <button
            class="absolute top-0 right-0 w-fit cursor-pointer p-2"
            :aria-label="t('settings.close')"
            @click="store.closeModal"
          >
            <X class="h-5 w-5" />
          </button>

          <h3 class="mb-4 text-xl font-semibold">{{ store.modal.title }}</h3>

          <p class="mb-6 text-base">{{ store.modal.message }}</p>

          <div v-if="store.modal.type === 'custom'">
            <slot></slot>
          </div>

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
