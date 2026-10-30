<script setup>
  import { ref, computed } from 'vue';
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useHabitUtils } from '@/composables/useHabitUtils';
  import { useModals } from '@/composables/useModals';
  import { useI18n } from 'vue-i18n';
  import { resolveLang } from '@/i18n';
  import { X } from 'lucide-vue-next';
  import Sheet from '@/components/Sheet.vue';
  import SyncStatus from '@/components/SyncStatus.vue';

  const emit = defineEmits([
    /** Запрос импорта */
    'import',
    /** Запрос печати бланка для фото */
    'printSheet',
    /** Запрос переноса отметок с фото бланка */
    'scanPhoto',
  ]);

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { isDesktop, modKey } = useHabitUtils();
  const { t } = useI18n();
  const { showWelcome } = useModals(t);

  const close = () => modalStore.closeModal();

  /** Сегментированный переключатель: варианты [value, label] */
  const themeOptions = computed(() => [
    ['system', t('settings.theme.system')],
    ['light', t('settings.theme.light')],
    ['dark', t('settings.theme.dark')],
  ]);
  const weekOptions = computed(() => [
    ['monday', t('settings.weekStart.monday')],
    ['sunday', t('settings.weekStart.sunday')],
  ]);
  const calcOptions = computed(() => [
    ['fullMonth', t('settings.calculationMode.fullMonth')],
    ['passedDays', t('settings.calculationMode.passedDays')],
  ]);

  const summaryOptions = computed(() =>
    ['auto', 'percent', 'stars', 'letter', 'school', 'hidden'].map(value => [
      value,
      t(`settings.summary.${value}`),
    ])
  );

  const segmentClass = active =>
    active ? 'bg-surface font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'hover:bg-surface/50';

  const userInitial = computed(() =>
    (store.user?.displayName || store.user?.email || '?').charAt(0).toUpperCase()
  );

  const login = async () => {
    try {
      await store.loginWithGoogle();
      modalStore.showToast(t('toast.signedIn'));
    } catch (error) {
      console.error(error);
    }
  };

  const exportData = () => {
    const name = store.exportData();
    modalStore.showToast(t('toast.exported', { name }));
  };

  /** Таблица CSV: открытый месяц или весь архив, заголовки на языке интерфейса */
  const exportCsv = scope => {
    const name = store.exportCsv(scope, {
      month: t('csv.month'),
      habit: t('csv.habit'),
      mark: t('csv.mark'),
      progress: t('csv.progress'),
      notes: t('csv.notes'),
    });
    modalStore.showToast(t('toast.exported', { name }));
  };

  /** Выход ждёт записи в облако; если она не подтвердилась, спрашиваем, что делать */
  const loggingOut = ref(false);
  const logoutBlocked = ref(false);

  const logout = async (force = false) => {
    loggingOut.value = true;
    try {
      const done = await store.logout({ force });
      logoutBlocked.value = !done;
      if (done) modalStore.showToast(t('toast.signedOut'));
    } catch (error) {
      console.error(error);
      modalStore.showToast(t('auth.logoutFailed'));
    } finally {
      loggingOut.value = false;
    }
  };

  /** Резервная копия открывается в окне импорта; нечитаемую можно только скачать */
  const restoreBackup = () => {
    const error = store.readBackup();
    if (error) {
      modalStore.showToast(t(error), {
        actionText: t('backup.download'),
        onAction: () => store.downloadBackup(),
      });
      return;
    }
    modalStore.replaceModal('import');
  };

  const backupHint = computed(() => {
    if (!store.backupAt) return t('settings.data.backupHintNoDate');
    const date = new Date(store.backupAt).toLocaleString(resolveLang(store.lang), {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return t('settings.data.backupHint', { date });
  });

  /** Системный диалог файла или печати открывается после закрытия окна настроек */
  const runAndClose = event => {
    close();
    emit(event);
  };

  const dataActions = computed(() => [
    { title: t('settings.data.export'), hint: t('settings.data.exportHint'), run: exportData },
    {
      title: t('settings.data.csv'),
      hint: t('settings.data.csvMonthHint'),
      run: () => exportCsv('month'),
      disabled: store.tasks.length === 0,
    },
    {
      title: t('settings.data.csv'),
      hint: t('settings.data.csvAllHint'),
      run: () => exportCsv('all'),
    },
    {
      title: t('settings.data.import'),
      hint: t('settings.data.importHint'),
      run: () => runAndClose('import'),
    },
    {
      title: t('settings.data.sheet'),
      hint: t('settings.data.sheetHint'),
      run: () => runAndClose('printSheet'),
      disabled: store.tasks.length === 0,
    },
    {
      title: t('settings.data.scan'),
      hint: t('settings.data.scanHint'),
      run: () => runAndClose('scanPhoto'),
      disabled: store.tasks.length === 0,
    },
    ...(store.backupAt === null
      ? []
      : [{ title: t('settings.data.backup'), hint: backupHint.value, run: restoreBackup }]),
  ]);

  const hotkeys = computed(() => [
    ['N', t('settings.hotkeys.n')],
    ['S', t('settings.hotkeys.s')],
    ['←', t('settings.hotkeys.arrowLeft')],
    ['→', t('settings.hotkeys.arrowRight')],
    ['T', t('settings.hotkeys.t')],
    ['/', t('settings.hotkeys.search')],
    [`${modKey}+Z`, t('settings.hotkeys.undo')],
    [`${modKey}+Shift+Z`, t('settings.hotkeys.redo')],
    ['Esc', t('settings.hotkeys.escape')],
  ]);
</script>

<template>
  <Sheet :label="t('settings.title')" width="lg" @close="close">
    <div class="bg-surface sticky top-0 z-[1] flex items-center justify-between px-6 pt-5 pb-3">
      <span class="text-[22px] font-bold tracking-tight">{{ t('settings.title') }}</span>
      <button
        class="bg-soft flex size-10 items-center justify-center rounded-full"
        :aria-label="t('common.close')"
        @click="close"
      >
        <X class="size-5" />
      </button>
    </div>

    <div class="flex flex-col gap-6 px-6 pt-1 pb-[max(env(safe-area-inset-bottom),24px)]">
      <!-- Аккаунт -->
      <section class="flex flex-col gap-2.5">
        <h3 class="text-muted text-xs font-semibold tracking-wider uppercase">
          {{ t('settings.account.title') }}
        </h3>
        <div v-if="store.user" class="border-line flex flex-col gap-3 rounded-[14px] border p-3">
          <div class="flex items-center gap-3">
            <span
              class="bg-soft flex size-10 shrink-0 items-center justify-center self-start rounded-full font-bold"
            >
              {{ userInitial }}
            </span>
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="truncate text-[15px] font-semibold">
                {{ store.user.email || store.user.displayName }}
              </span>
              <SyncStatus detailed />
            </div>
            <button
              class="border-line enabled:hover:bg-soft h-9 shrink-0 self-start rounded-[10px] border px-3 text-[13px] disabled:opacity-50"
              :disabled="loggingOut || logoutBlocked"
              @click="logout()"
            >
              {{ loggingOut ? t('auth.loggingOut') : t('auth.logout') }}
            </button>
          </div>
          <div
            v-if="logoutBlocked"
            class="border-danger flex flex-col gap-3 rounded-xl border-[1.5px] p-3"
            role="alert"
          >
            <span class="text-sm leading-normal">{{ t('auth.unsaved') }}</span>
            <div class="flex flex-wrap justify-end gap-2">
              <button
                class="border-line h-9 rounded-[10px] border px-3 text-[13px]"
                @click="logoutBlocked = false"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                class="border-line h-9 rounded-[10px] border px-3 text-[13px]"
                @click="exportData"
              >
                {{ t('auth.saveFile') }}
              </button>
              <button
                class="bg-danger h-9 rounded-[10px] px-3 text-[13px] font-semibold text-white disabled:opacity-50"
                :disabled="loggingOut"
                @click="logout(true)"
              >
                {{ t('auth.logoutAnyway') }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="border-line flex flex-col gap-2.5 rounded-[14px] border p-3.5">
          <span class="text-muted text-sm leading-normal">
            {{ t('settings.account.localOnly') }}
          </span>
          <button
            class="border-line2 bg-surface hover:bg-soft h-11 rounded-xl border text-sm font-semibold"
            @click="login"
          >
            {{ t('auth.login') }}
          </button>
        </div>
      </section>

      <!-- Оформление -->
      <section class="flex flex-col gap-3.5">
        <h3 class="text-muted text-xs font-semibold tracking-wider uppercase">
          {{ t('settings.appearance') }}
        </h3>
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">{{ t('settings.theme.title') }}</span>
          <div class="bg-soft grid grid-cols-3 gap-1 rounded-xl p-1" role="radiogroup">
            <button
              v-for="[value, label] in themeOptions"
              :key="value"
              role="radio"
              :aria-checked="store.theme === value"
              class="h-[38px] rounded-[9px] text-sm"
              :class="segmentClass(store.theme === value)"
              @click="store.setTheme(value)"
            >
              {{ label }}
            </button>
          </div>
        </div>
        <label class="flex items-center justify-between gap-3">
          <span class="text-sm font-medium">{{ t('settings.lang.title') }}</span>
          <select
            :value="store.lang"
            class="border-line2 bg-surface h-10 min-w-[180px] rounded-[10px] border px-3 text-sm"
            @change="store.setLang($event.target.value)"
          >
            <option value="system">{{ t('settings.asInSystem') }}</option>
            <option value="ru">Русский</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="zh">中文</option>
            <option value="ar">العربية</option>
          </select>
        </label>
      </section>

      <!-- Таблица -->
      <section class="flex flex-col gap-3.5">
        <h3 class="text-muted text-xs font-semibold tracking-wider uppercase">
          {{ t('settings.table') }}
        </h3>
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm font-medium">{{ t('settings.weekStart.title') }}</span>
          <div class="bg-soft flex gap-1 rounded-xl p-1" role="radiogroup">
            <button
              v-for="[value, label] in weekOptions"
              :key="value"
              role="radio"
              :aria-checked="store.weekStart === value"
              class="h-[34px] rounded-[9px] px-3.5 text-sm"
              :class="segmentClass(store.weekStart === value)"
              @click="store.setWeekStart(value)"
            >
              {{ label }}
            </button>
          </div>
        </div>
        <button
          role="switch"
          :aria-checked="store.showWeekSeparators"
          class="flex items-center justify-between gap-3 text-start"
          @click="store.setShowWeekSeparators(!store.showWeekSeparators)"
        >
          <span class="flex flex-col gap-0.5">
            <span class="text-sm font-medium">{{ t('settings.showWeek.title') }}</span>
            <span class="text-muted text-xs">{{ t('settings.showWeek.hint') }}</span>
          </span>
          <span
            class="flex h-7 w-[46px] shrink-0 items-center rounded-full p-[3px] transition-colors"
            :class="store.showWeekSeparators ? 'bg-ink justify-end' : 'bg-line2 justify-start'"
          >
            <span
              class="size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)]"
            ></span>
          </span>
        </button>
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">{{ t('settings.calculationMode.title') }}</span>
          <div class="bg-soft grid grid-cols-2 gap-1 rounded-xl p-1" role="radiogroup">
            <button
              v-for="[value, label] in calcOptions"
              :key="value"
              role="radio"
              :aria-checked="store.calculationMode === value"
              class="h-[38px] rounded-[9px] text-sm"
              :class="segmentClass(store.calculationMode === value)"
              @click="store.setCalculationMode(value)"
            >
              {{ label }}
            </button>
          </div>
          <span class="text-muted text-xs leading-snug">
            {{
              store.calculationMode === 'fullMonth'
                ? t('settings.calculationMode.fullMonthHint')
                : t('settings.calculationMode.passedDaysHint')
            }}
          </span>
        </div>
        <label class="flex items-center justify-between gap-3">
          <span class="flex flex-col gap-0.5">
            <span class="text-sm font-medium">{{ t('settings.summary.title') }}</span>
            <span class="text-muted text-xs">{{ t('settings.summary.hint') }}</span>
          </span>
          <select
            :value="store.summaryStyle"
            class="border-line2 bg-surface h-10 min-w-[180px] rounded-[10px] border px-3 text-sm"
            @change="store.setSummaryStyle($event.target.value)"
          >
            <option v-for="[value, label] in summaryOptions" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </label>
      </section>

      <!-- Данные -->
      <section class="flex flex-col gap-2.5">
        <h3 class="text-muted text-xs font-semibold tracking-wider uppercase">
          {{ t('settings.data.title') }}
        </h3>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="action in dataActions"
            :key="action.title + action.hint"
            class="border-line enabled:hover:bg-soft flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 disabled:opacity-40"
            :disabled="action.disabled"
            @click="action.run"
          >
            <span class="text-sm font-semibold">{{ action.title }}</span>
            <span class="text-muted text-[11px]">{{ action.hint }}</span>
          </button>
        </div>
      </section>

      <!-- Горячие клавиши -->
      <section v-if="isDesktop" class="flex flex-col gap-2.5">
        <h3 class="text-muted text-xs font-semibold tracking-wider uppercase">
          {{ t('settings.hotkeys.title') }}
        </h3>
        <div class="grid grid-cols-2 gap-x-5 gap-y-2">
          <div
            v-for="[key, label] in hotkeys"
            :key="key"
            class="flex items-center gap-2.5 text-[13px]"
          >
            <kbd
              class="border-line2 flex h-[26px] min-w-[30px] items-center justify-center rounded-md border border-b-2 px-1.5 font-sans text-xs font-semibold"
            >
              {{ key }}
            </kbd>
            <span class="text-muted">{{ label }}</span>
          </div>
        </div>
      </section>

      <div class="border-line flex items-center justify-between gap-3 border-t pt-1">
        <button class="h-10 text-sm underline underline-offset-3" @click="showWelcome(true)">
          {{ t('settings.showWelcome') }}
        </button>
        <span class="text-muted text-xs">Table · Apache-2.0</span>
      </div>
    </div>
  </Sheet>
</template>
