<script setup lang="ts">
defineProps<{ exporting: boolean }>()
const emit = defineEmits<{ export: []; import: []; manageCategories: []; deleteAccount: [] }>()
const { t } = useI18n()

const actionClass =
  'flex min-h-12 items-center gap-2.5 rounded-(--radius-control) border border-border bg-surface px-4 text-left text-sm font-medium text-ink transition-colors hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60'
</script>

<template>
  <SettingsCard id="settings-data" :title="t('settings.data.title')">
    <div class="flex flex-col gap-3">
      <button
        type="button"
        :class="actionClass"
        :disabled="exporting"
        :aria-busy="exporting || undefined"
        @click="emit('export')"
      >
        <AppIcon name="download" />
        {{ t('settings.data.export') }}
      </button>
      <button type="button" :class="actionClass" @click="emit('import')">
        <AppIcon name="plus" />
        {{ t('settings.data.import') }}
      </button>
      <button type="button" :class="actionClass" @click="emit('manageCategories')">
        <AppIcon name="budgets" />
        {{ t('settings.data.manageCategories') }}
      </button>
      <button
        type="button"
        class="mt-2 min-h-11 self-start rounded-(--radius-control) px-1 text-sm font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        @click="emit('deleteAccount')"
      >
        {{ t('settings.data.deleteAccount') }}
      </button>
    </div>
  </SettingsCard>
</template>
