<script setup>
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useI18n } from 'vue-i18n';

  defineProps({
    /** Короткий текст для телефона */
    compact: Boolean,
  });

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { currentMonthLabel, realMonthLabel } = useHabitUtils();
  const { t } = useI18n();
</script>

<template>
  <!-- status: при переходе в прошлый месяц скринридер сообщает, что это архив -->
  <div
    role="status"
    class="hide-print bg-soft flex items-center gap-2.5 rounded-[14px] py-2.5 ps-3.5 pe-2.5 md:gap-3 md:rounded-xl md:ps-4"
  >
    <span class="text-muted flex-1 text-[13px] leading-snug md:text-sm">
      {{ compact ? t('archive.bannerShort') : t('archive.banner', { month: currentMonthLabel }) }}
    </span>
    <button
      v-if="store.tasks.length > 0"
      class="border-line2 bg-surface hover:bg-soft h-9 rounded-[10px] border px-3 text-[13px] font-semibold whitespace-nowrap md:h-[34px] md:px-3.5"
      @click="modalStore.openModal('duplicate', { from: store.currentMonthKey })"
    >
      {{
        compact
          ? t('archive.moveTo', { month: realMonthLabel })
          : t('archive.moveToLong', { month: realMonthLabel })
      }}
    </button>
  </div>
</template>
