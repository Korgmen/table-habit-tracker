<script setup>
  import { provide } from 'vue';
  import { MODAL_ID } from '@/composables/useModals';
  import SettingsSheet from '@/components/SettingsSheet.vue';
  import HabitSheet from '@/components/HabitSheet.vue';
  import DuplicateSheet from '@/components/DuplicateSheet.vue';
  import WelcomeSheet from '@/components/WelcomeSheet.vue';
  import ConflictSheet from '@/components/ConflictSheet.vue';
  import ImportSheet from '@/components/ImportSheet.vue';
  import NoteSheet from '@/components/NoteSheet.vue';
  import StatsSheet from '@/components/StatsSheet.vue';
  import SearchSheet from '@/components/SearchSheet.vue';
  import PhotoImport from '@/components/PhotoImport.vue';

  const props = defineProps({
    /** Окно из стека modalStore: { id, name, props } */
    entry: { type: Object, required: true },
  });

  /** Окна по имени из modalStore */
  const SHEETS = {
    settings: SettingsSheet,
    habit: HabitSheet,
    duplicate: DuplicateSheet,
    welcome: WelcomeSheet,
    conflict: ConflictSheet,
    import: ImportSheet,
    note: NoteSheet,
    stats: StatsSheet,
    search: SearchSheet,
    photo: PhotoImport,
  };

  /** Компонент окна закрывает себя по этому id (useModalEntry) */
  provide(MODAL_ID, props.entry.id);
</script>

<template>
  <component :is="SHEETS[entry.name]" v-bind="entry.props" />
</template>
