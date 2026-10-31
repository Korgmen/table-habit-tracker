<script setup>
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals, useModalHistory } from '@/composables/useModals';
  import { ref, watch, watchEffect, nextTick, provide, onMounted, onUnmounted } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { registerSW } from 'virtual:pwa-register';
  import DesktopHeader from '@/components/DesktopHeader.vue';
  import ArchiveBanner from '@/components/ArchiveBanner.vue';
  import HabitGrid from '@/components/HabitGrid.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import MobileView from '@/components/MobileView.vue';
  import Toast from '@/components/Toast.vue';
  import ModalEntry from '@/components/ModalEntry.vue';
  import { useSearch } from '@/composables/useSearch';
  import PaperSheet from '@/components/PaperSheet.vue';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { currentTheme, canNextMonth, isDesktop, isCurrentMonth, monthKeyLabel } = useHabitUtils();
  const { t } = useI18n();
  const { searchInput } = useSearch();
  const {
    openNewHabit,
    openSettings,
    showWelcome,
    showUpdatePrompt,
    showOfflineReady,
    showCloudConflict,
    undoLast,
    redoLast,
    toastWithUndo,
  } = useModals(t);

  useModalHistory();

  /** Цвет строки состояния и заголовка окна PWA – фон приложения (--bg в style.css) */
  const THEME_COLORS = { light: '#f7f7f5', dark: '#121211' };

  /**
   * Тема применяется к <html>, чтобы её видели и окна, вынесенные в body. До загрузки скрипта
   * её ставит inline-скрипт в index.html, здесь она следует за настройкой и системной темой.
   */
  watchEffect(() => {
    document.documentElement.dataset.theme = currentTheme.value;
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.removeAttribute('media');
      meta.content = THEME_COLORS[currentTheme.value];
    });
  });

  /** Конфликт определяет стор, диалог показывается здесь, когда конфликт появился */
  watch(
    () => store.cloudConflict,
    (conflict, previous) => {
      if (conflict && !previous) showCloudConflict();
    }
  );

  /** Автоперенос привычек в новый месяц сообщается тостом с отменой */
  watch(
    () => store.lastCarry,
    carry => {
      if (!carry || store.lastChangeId !== carry.id) return;
      toastWithUndo(
        t('carry.auto', { count: carry.count, month: monthKeyLabel(carry.from) }, carry.count)
      );
    }
  );

  /** Сбой облака сообщается один раз при появлении ошибки, повторы видны в статусе */
  watch(
    () => store.syncError,
    (code, previous) => {
      if (code && !previous) modalStore.showToast(t('sync.failed'));
    }
  );

  /** Браузер отказал в записи: данные живут только в памяти вкладки */
  watch(
    () => store.localSaveError,
    error => {
      if (!error) return;
      modalStore.showToast(t(error === 'quota' ? 'storage.quota' : 'storage.failed'), {
        actionText: t('settings.data.export'),
        onAction: () => modalStore.showToast(t('toast.exported', { name: store.exportData() })),
      });
    }
  );

  /** Ссылка на скрытый input для импорта файла */
  const importInput = ref(null);

  /** Печатается бланк для фото вместо интерфейса */
  const sheetPrinting = ref(false);

  /** Ссылка на скрытый input для фото бланка */
  const photoInput = ref(null);

  /** Глобальные горячие клавиши; ввод в полях и открытые окна их не вызывают */
  const handleKeydown = event => {
    if (modalStore.isOpen) {
      /** Фокус ушёл из окна (например, на body после клика): Escape всё равно закрывает верхнее */
      if (event.key === 'Escape') modalStore.closeModal();
      return;
    }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;

    /** Ctrl/⌘+Z – отмена, Ctrl/⌘+Shift+Z и Ctrl+Y – повтор */
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const redo = event.code === 'KeyY' || (event.code === 'KeyZ' && event.shiftKey);
      if (event.code !== 'KeyZ' && !redo) return;
      event.preventDefault();
      if (redo) redoLast();
      else undoLast();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    /** Стрелки идут по направлению текста: в арабском (RTL) прошлый месяц справа */
    const rtl = document.documentElement.dir === 'rtl';
    const prevMonth = () => store.prevMonth();
    const nextMonth = () => canNextMonth.value && store.nextMonth();

    const keyActions = {
      KeyN: openNewHabit,
      KeyS: openSettings,
      KeyT: () => store.goToToday(),
      Slash: () => searchInput.value?.focus(),
      ArrowLeft: rtl ? nextMonth : prevMonth,
      ArrowRight: rtl ? prevMonth : nextMonth,
    };

    const action = keyActions[event.code];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  /** Открывает системный диалог выбора файла для импорта */
  const triggerImport = () => importInput.value.click();

  const handleImportSelected = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const error = await store.readImportFile(file);
    if (error) {
      modalStore.showToast(t(error), { actionText: t('import.other'), onAction: triggerImport });
    } else {
      modalStore.openModal('import');
    }
  };

  /** Бланк больше не нужен: обычный вид возвращается и при печати, и после неё */
  const endSheetPrint = () => {
    sheetPrinting.value = false;
    window.removeEventListener('pointerdown', endSheetPrint, true);
    window.removeEventListener('keydown', endSheetPrint, true);
  };

  /** Окно печати закрылось: в Safari на iOS afterprint бывает не приходит, но media query – да */
  const printMedia = window.matchMedia('print');
  const handlePrintMedia = event => {
    if (!event.matches && sheetPrinting.value) endSheetPrint();
  };

  /**
   * Печатает бланк открытого месяца. Обычный вид возвращают afterprint или выход из print media,
   * а если браузер не прислал ни того, ни другого, – первое касание или клавиша после печати.
   */
  const triggerSheetPrint = async () => {
    sheetPrinting.value = true;
    await nextTick();
    window.print();
    if (!sheetPrinting.value) return;
    window.addEventListener('pointerdown', endSheetPrint, true);
    window.addEventListener('keydown', endSheetPrint, true);
  };

  /** Открывает выбор фото бланка (на телефоне – с камерой) */
  const triggerPhotoImport = () => photoInput.value.click();

  const handlePhotoSelected = event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (file) modalStore.openModal('photo', { file });
  };

  /** Действия, которым нужны скрытые input и бланк печати: их вызывает окно настроек */
  provide('appActions', {
    import: triggerImport,
    printSheet: triggerSheetPrint,
    scanPhoto: triggerPhotoImport,
  });

  /** Свёрнутое приложение дописывает отложенные записи, вернувшееся сверяет дату */
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      store.flushLocalSave();
      store.flushCloudSave();
    } else {
      store.syncRealDate();
    }
  };

  const handlePageHide = () => store.flushLocalSave();

  /** Сеть вернулась: синхронизация продолжается сразу, без ожидания очередного повтора */
  const handleOnline = () => store.retrySync();

  const handleOffline = () => store.markOffline();

  /** Проверка смены дня, пока приложение открыто */
  let realDateTimer = null;

  onMounted(() => {
    /** Регистрация Service Worker с обработкой обновления */
    const updateSW = registerSW({
      onNeedRefresh() {
        showUpdatePrompt(updateSW);
      },
      onOfflineReady() {
        showOfflineReady();
      },
    });
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('afterprint', endSheetPrint);
    printMedia.addEventListener('change', handlePrintMedia);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    realDateTimer = setInterval(() => store.syncRealDate(), 60 * 1000);
    /** Первый запуск в новом месяце переносит привычки прошлого */
    store.autoCarryOver();
    /** Показывает приветствие при первом запуске */
    showWelcome();
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('afterprint', endSheetPrint);
    printMedia.removeEventListener('change', handlePrintMedia);
    endSheetPrint();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(realDateTimer);
  });
</script>

<template>
  <div :class="{ 'print:hidden': sheetPrinting }">
    <!-- Десктоп: таблица месяца -->
    <div
      v-if="isDesktop"
      class="flex h-dvh flex-col overflow-hidden print:h-auto print:overflow-visible"
    >
      <DesktopHeader />
      <ArchiveBanner v-if="!isCurrentMonth" class="mx-8 mb-3.5" />
      <HabitGrid v-if="store.tasks.length > 0" />
      <EmptyState v-else />
    </div>

    <!-- Телефон: лента дней и отметки за выбранный день -->
    <MobileView v-else />
  </div>

  <!-- Скрытые input для импорта JSON и фото бланка -->
  <input
    ref="importInput"
    type="file"
    class="hidden"
    accept=".json"
    @change="handleImportSelected"
  />
  <input
    ref="photoInput"
    type="file"
    class="hidden"
    accept="image/*"
    @change="handlePhotoSelected"
  />

  <!-- Бланк для печати и распознавания с фото -->
  <PaperSheet v-if="sheetPrinting" />

  <!-- Окна (стек modalStore, верхнее активно) и тост -->
  <ModalEntry v-for="entry in modalStore.stack" :key="entry.id" :entry="entry" />
  <Toast />
</template>
