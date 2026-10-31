<script setup>
  import { useModalStore } from '@/stores/modalStore';
  import { useI18n } from 'vue-i18n';
  import { X } from 'lucide-vue-next';

  const modalStore = useModalStore();
  const { t } = useI18n();
</script>

<template>
  <transition name="fade">
    <div
      v-if="modalStore.toast"
      class="hide-print pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),16px)] z-[60] flex justify-center px-4 md:bottom-7"
      role="status"
      aria-live="polite"
    >
      <!-- Пока курсор или фокус на тосте, он не скрывается -->
      <div
        class="bg-ink text-bg pointer-events-auto flex min-h-12 max-w-[440px] items-center gap-3 rounded-[14px] py-1.5 ps-4 pe-1.5 shadow-[0_10px_30px_rgba(0,0,0,.25)]"
        @mouseenter="modalStore.pauseToast()"
        @mouseleave="modalStore.resumeToast()"
        @focusin="modalStore.pauseToast()"
        @focusout="modalStore.resumeToast()"
      >
        <span class="flex-1 text-sm leading-snug">{{ modalStore.toast.text }}</span>
        <button
          v-if="modalStore.toast.actionText"
          class="bg-bg text-ink h-9 rounded-[10px] px-3.5 text-[13px] font-semibold whitespace-nowrap"
          @click="modalStore.runToastAction()"
        >
          {{ modalStore.toast.actionText }}
        </button>
        <button
          class="flex size-9 items-center justify-center opacity-70"
          :aria-label="t('common.close')"
          @click="modalStore.closeToast()"
        >
          <X class="size-[18px]" />
        </button>
      </div>
    </div>
  </transition>
</template>
