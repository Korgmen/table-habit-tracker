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
    class="hide-print bg-soft flex flex-wrap items-center gap-2.5 rounded-[14px] py-2.5 ps-3.5 pe-2.5 md:flex-nowrap md:gap-3 md:rounded-xl md:ps-4"
  >
    <span class="text-muted flex-1 basis-40 text-[13px] leading-snug md:basis-auto md:text-sm">
      {{ compact ? t('archive.bannerShort') : t('archive.banner', { month: currentMonthLabel }) }}
    </span>
    <!-- Кнопки переносятся на новую строку вместе -->
    <div class="flex gap-2">
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
      <!-- На телефоне кнопке текущего месяца нет места в шапке рядом с поиском и меню -->
      <button
        v-if="compact"
        class="border-line2 bg-surface h-9 rounded-[10px] border px-3 text-[13px] font-semibold whitespace-nowrap"
        @click="store.goToToday()"
      >
        {{ t('month.currentShort') }}
      </button>
    </div>
  </div>
</template>
