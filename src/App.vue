<script setup>
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { ref, watch, watchEffect, nextTick, onMounted, onUnmounted } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { registerSW } from 'virtual:pwa-register';
  import DesktopHeader from '@/components/DesktopHeader.vue';
  import ArchiveBanner from '@/components/ArchiveBanner.vue';
  import HabitGrid from '@/components/HabitGrid.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import MobileView from '@/components/MobileView.vue';
  import Toast from '@/components/Toast.vue';
  import SettingsSheet from '@/components/SettingsSheet.vue';
  import HabitSheet from '@/components/HabitSheet.vue';
  import DuplicateSheet from '@/components/DuplicateSheet.vue';
  import WelcomeSheet from '@/components/WelcomeSheet.vue';
  import ConflictSheet from '@/components/ConflictSheet.vue';
  import ImportSheet from '@/components/ImportSheet.vue';
  import PaperSheet from '@/components/PaperSheet.vue';
  import PhotoImport from '@/components/PhotoImport.vue';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { currentTheme, canNextMonth, isDesktop, isCurrentMonth } = useHabitUtils();
  const { t } = useI18n();
  const { openNewHabit, showWelcome, showUpdatePrompt, showCloudConflict, undoLast, redoLast } =
    useModals(t);

  /** Тема применяется к <html>, чтобы её видели и окна, вынесенные в body */
  watchEffect(() => {
    document.documentElement.dataset.theme = currentTheme.value;
  });

  /** Конфликт определяет стор после входа, диалог показывается здесь */
  watch(
    () => store.cloudConflict,
    conflict => {
      if (conflict) showCloudConflict();
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

  /** Окна по имени из modalStore */
  const sheets = {
    habit: HabitSheet,
    duplicate: DuplicateSheet,
    welcome: WelcomeSheet,
    conflict: ConflictSheet,
    import: ImportSheet,
  };

  /** Ссылка на скрытый input для импорта файла */
  const importInput = ref(null);

  /** Печатается бланк для фото вместо интерфейса */
  const sheetPrinting = ref(false);

  /** Ссылка на скрытый input для фото бланка и выбранное фото */
  const photoInput = ref(null);
  const photoFile = ref(null);

  /** Глобальные горячие клавиши; ввод в полях и открытые окна их не вызывают */
  const handleKeydown = event => {
    if (modalStore.isOpen) return;
    if (photoFile.value) {
      if (event.code === 'Escape') photoFile.value = null;
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

    const keyActions = {
      KeyN: openNewHabit,
      KeyS: () => modalStore.showModal('settings'),
      KeyT: () => store.goToToday(),
      ArrowLeft: () => store.prevMonth(),
      ArrowRight: () => canNextMonth.value && store.nextMonth(),
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
      modalStore.showModal('import');
    }
  };

  /** Печатает бланк открытого месяца; обычный вид возвращает событие afterprint */
  const triggerSheetPrint = async () => {
    sheetPrinting.value = true;
    await nextTick();
    window.print();
  };

  const handleAfterPrint = () => {
    sheetPrinting.value = false;
  };

  /** Открывает выбор фото бланка (на телефоне – с камерой) */
  const triggerPhotoImport = () => photoInput.value.click();

  const handlePhotoSelected = event => {
    photoFile.value = event.target.files[0] || null;
    event.target.value = '';
  };

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
        console.log('App ready to work offline');
      },
    });
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('afterprint', handleAfterPrint);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    realDateTimer = setInterval(() => store.syncRealDate(), 60 * 1000);
    /** Показывает приветствие при первом запуске */
    showWelcome();
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('afterprint', handleAfterPrint);
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

  <!-- Проверка отметок, распознанных с фото бланка -->
  <PhotoImport
    v-if="photoFile"
    :key="photoFile.name + photoFile.lastModified"
    :file="photoFile"
    @close="photoFile = null"
  />

  <!-- Глобальное окно и тост -->
  <SettingsSheet
    v-if="modalStore.modal.name === 'settings'"
    @import="triggerImport"
    @print-sheet="triggerSheetPrint"
    @scan-photo="triggerPhotoImport"
  />
  <component
    :is="sheets[modalStore.modal.name]"
    v-else-if="modalStore.isOpen"
    :key="modalStore.modal.name + JSON.stringify(modalStore.modal.props)"
    v-bind="modalStore.modal.props"
  />
  <Toast />
</template>
