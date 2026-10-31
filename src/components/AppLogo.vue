<script setup>
  import { useI18n } from 'vue-i18n';

  defineProps({
    /** sm – подвал настроек, md – шапки, lg – приветствие */
    size: { type: String, default: 'md' },
  });

  const { t } = useI18n();

  const SIZES = {
    sm: { icon: 'size-4', text: 'text-sm' },
    md: { icon: 'size-6', text: 'text-xl' },
    lg: { icon: 'size-9', text: 'text-[28px]' },
  };
</script>

<template>
  <!-- Лого: кольцо из иконки приложения (public/favicons) и название в ряд -->
  <span class="inline-flex items-center gap-[0.35em] font-bold tracking-tight" dir="ltr">
    <svg :class="SIZES[size].icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="4" />
    </svg>
    <span :class="SIZES[size].text">{{ t('app.name') }}</span>
  </span>
</template>
