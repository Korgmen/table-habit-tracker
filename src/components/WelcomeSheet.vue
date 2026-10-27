<script setup>
  import { useHabitStore } from '@/stores/habitStore';
  import { useModalStore } from '@/stores/modalStore';
  import { useI18n } from 'vue-i18n';
  import Sheet from '@/components/Sheet.vue';
  import MarkCircle from '@/components/MarkCircle.vue';

  const store = useHabitStore();
  const modalStore = useModalStore();
  const { t } = useI18n();

  const close = () => {
    localStorage.setItem('hasSeenWelcome', 'true');
    modalStore.closeModal();
  };

  const login = async () => {
    close();
    try {
      await store.loginWithGoogle();
      modalStore.showToast(t('toast.signedIn'));
    } catch (error) {
      console.error(error);
    }
  };

  const legend = [
    { mark: true, key: 'done' },
    { mark: null, key: 'notDone' },
    { mark: false, key: 'skip' },
  ];
</script>

<template>
  <Sheet :label="t('welcome.title')" @close="close">
    <div class="flex flex-col gap-4 px-6 pt-7 pb-2">
      <span class="text-accent text-[13px] font-semibold tracking-wide uppercase">Table</span>
      <span class="text-[28px] leading-[1.1] font-bold tracking-tight text-balance">
        {{ t('welcome.title') }}
      </span>
      <span class="text-muted text-[15px] leading-relaxed text-pretty">
        {{ t('welcome.text') }}
      </span>
      <div class="border-line flex flex-col rounded-[14px] border">
        <div
          v-for="item in legend"
          :key="item.key"
          class="border-line flex items-center gap-3.5 border-b px-3.5 py-3 last:border-b-0"
        >
          <MarkCircle :mark="item.mark" size="md" class="size-[22px]!" />
          <span class="text-sm leading-snug">
            <b>{{ t(`welcome.${item.key}`) }}</b>
            <template v-if="item.key !== 'done'">
              {{ ` – ${t(`welcome.${item.key}Hint`)}` }}
            </template>
          </span>
        </div>
      </div>
      <span class="text-muted text-sm leading-relaxed text-pretty">{{ t('welcome.paper') }}</span>
    </div>
    <div class="flex flex-wrap gap-2 px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)]">
      <button
        v-if="!store.user"
        class="border-line2 hover:bg-soft h-12 min-w-40 flex-1 rounded-xl border text-[15px] font-semibold"
        @click="login"
      >
        {{ t('auth.login') }}
      </button>
      <button
        class="bg-ink text-bg h-12 min-w-40 flex-1 rounded-xl text-[15px] font-semibold"
        @click="close"
      >
        {{ t('welcome.start') }}
      </button>
    </div>
  </Sheet>
</template>
