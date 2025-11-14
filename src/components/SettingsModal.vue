<script setup>
  import { useHabitStore } from '@/stores/habitStore';
  import { useModals } from '@/composables/useModals';
  import { ref } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { X, Upload, Download, Printer } from 'lucide-vue-next';

  defineProps({
    /** Открыто ли окно настроек */
    isOpen: Boolean,
    /** Текущая тема (light/dark) */
    currentTheme: String,
  });

  const emit = defineEmits([
    /** Закрытие окна */
    'close',
    /** Запрос импорта */
    'import',
    /** Запрос печати */
    'print',
  ]);

  const store = useHabitStore();
  const { t, locale } = useI18n();
  const { showWelcome } = useModals(t);

  /** Локальная копия выбранного языка для синхронизации с select */
  const lang = ref(store.lang);

  /** Сохраняет выбранный язык и обновляет локаль i18n */
  const changeLang = () => {
    store.setLang(lang.value);
    let systemLang = 'en';
    const navLang = navigator.language.toLowerCase();
    if (navLang.startsWith('ru')) systemLang = 'ru';
    else if (navLang.startsWith('ar')) systemLang = 'ar';
    else if (navLang.startsWith('es')) systemLang = 'es';
    else if (navLang.startsWith('zh')) systemLang = 'zh';
    locale.value = lang.value === 'system' ? systemLang : lang.value;
  };

  /** Передаёт событие импорта вверх */
  const handleImport = () => {
    emit('import');
  };

  /** Передаёт событие печати вверх */
  const handlePrint = () => {
    emit('print');
  };
</script>

<template>
  <!-- Окно настроек -->
  <div
    class="hide-print absolute top-0 right-0 z-50 w-screen border-3 p-4 md:w-fit print:w-fit"
    :class="currentTheme === 'dark' ? 'bg-[#292929] text-[#FFF8F0]' : 'bg-white text-[#12130F]'"
  >
    <!-- Кнопка закрытия -->
    <button
      class="tap-highlight-transparent absolute top-2 right-2 cursor-pointer touch-manipulation"
      :aria-label="t('settings.close')"
      @click="emit('close')"
    >
      <X class="h-5 w-5" />
    </button>

    <div class="flex flex-col gap-5">
      <!-- Основные настройки -->
      <div
        class="flex flex-col gap-2.5 md:grid md:grid-cols-[repeat(2,1fr)] print:grid print:grid-cols-[repeat(2,1fr)]"
      >
        <h3 class="col-span-2 text-lg font-semibold">{{ t('settings.title') }}</h3>

        <!-- Выбор темы -->
        <div class="flex flex-col gap-1.5">
          <label class="block">{{ t('settings.theme.title') }}</label>
          <select
            v-model="store.theme"
            class="w-full border-2 p-1"
            @change="store.setTheme(store.theme)"
          >
            <option value="system">{{ t('settings.asInSystem') }}</option>
            <option value="light">{{ t('settings.theme.light') }}</option>
            <option value="dark">{{ t('settings.theme.dark') }}</option>
          </select>
        </div>

        <!-- Выбор языка -->
        <div class="flex flex-col gap-1.5">
          <label class="block">{{ t('settings.lang.title') }}</label>
          <select v-model="lang" class="w-full border-2 p-1" @change="changeLang">
            <option value="system">{{ t('settings.asInSystem') }}</option>
            <option value="ru">Русский</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
            <option value="es">Español</option>
            <option value="zh">中文</option>
          </select>
        </div>

        <!-- Экспорт/импорт -->
        <div class="flex flex-col gap-1.5">
          <label class="block">{{ t('settings.expImp.title') }}</label>
          <div class="flex items-center gap-1.5">
            <button
              class="tap-highlight-transparent relative flex h-8 cursor-pointer touch-manipulation items-center justify-center border-2 border-green-500 px-1.5 text-green-500"
              @click="store.exportData"
            >
              <Upload class="w-5" />
            </button>
            <button
              class="tap-highlight-transparent relative flex h-8 cursor-pointer touch-manipulation items-center justify-center border-2 border-purple-500 px-1.5 text-purple-500"
              @click="handleImport"
            >
              <Download class="w-5" />
            </button>
          </div>
        </div>

        <!-- Печать -->
        <div class="flex flex-col gap-1.5">
          <label class="block">{{ t('settings.print.title') }}</label>
          <div class="flex items-center gap-1.5">
            <button
              class="tap-highlight-transparent relative flex h-8 cursor-pointer touch-manipulation items-center justify-center border-2 px-1.5"
              @click="handlePrint"
            >
              <Printer class="w-5" />
            </button>
          </div>
        </div>

        <!-- Показ разделителей недель -->
        <div class="flex flex-col gap-1.5">
          <label class="block">{{ t('settings.showWeek.title') }}</label>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              v-model="store.showWeekSeparators"
              @change="store.setShowWeekSeparators(store.showWeekSeparators)"
            />
            {{ t('settings.showWeek.checkbox') }}
          </label>

          <!-- Начало недели (если включены разделители) -->
          <div v-if="store.showWeekSeparators" class="col-span-2 mt-1.5 flex flex-col gap-1.5">
            <label class="block">{{ t('settings.weekStart.title') }}</label>
            <select
              v-model="store.weekStart"
              class="w-full border-2 p-1"
              @change="store.setWeekStart(store.weekStart)"
            >
              <option value="monday">{{ t('settings.weekStart.monday') }}</option>
              <option value="sunday">{{ t('settings.weekStart.sunday') }}</option>
            </select>
          </div>
        </div>

        <!-- Режим расчёта прогресса -->
        <div class="flex flex-col gap-1.5">
          <label class="block">{{ t('settings.calculationMode.title') }}</label>
          <select
            v-model="store.calculationMode"
            class="w-full border-2 p-1"
            @change="store.setCalculationMode(store.calculationMode)"
          >
            <option value="fullMonth">{{ t('settings.calculationMode.fullMonth') }}</option>
            <option value="passedDays">{{ t('settings.calculationMode.passedDays') }}</option>
          </select>
        </div>
      </div>

      <!-- Горячие клавиши -->
      <div class="flex flex-col gap-2.5">
        <h3 class="text-lg font-semibold">{{ t('settings.hotkeys.title') }}</h3>
        <div class="flex flex-col gap-1.5">
          <ul class="leading-relaxed">
            <li>{{ t('settings.hotkeys.escape') }}</li>
            <li>{{ t('settings.hotkeys.e') }}</li>
            <li>{{ t('settings.hotkeys.d') }}</li>
            <li>{{ t('settings.hotkeys.n') }}</li>
            <li>{{ t('settings.hotkeys.arrowLeft') }}</li>
            <li>{{ t('settings.hotkeys.arrowRight') }}</li>
            <li>{{ t('settings.hotkeys.s') }}</li>
          </ul>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <button
            class="tap-highlight-transparent relative flex h-8 cursor-pointer touch-manipulation items-center justify-center border-2 px-1.5"
            @click="showWelcome(true)"
          >
            Показать окно приветствия
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
