<script setup lang="ts">
import type { NotificationPrefs } from '~/shared/api/contract'

const { t } = useI18n()
const { settings, isPending, isError, hasData, refetch, draft, saving, change } = useSettingsChange()

const keys: (keyof NotificationPrefs)[] = ['budgetLimit', 'dailyReminder', 'weeklyReport', 'goals']
const shown = computed(() => draft.value.notifications ?? settings.value.notifications)

function toggle(key: keyof NotificationPrefs, enabled: boolean) {
  change({ notifications: { ...settings.value.notifications, [key]: enabled } })
}
</script>

<template>
  <SettingsCard id="settings-notifications" :title="t('settings.notifications.title')">
    <ErrorState v-if="isError && !hasData" compact @retry="refetch()" />
    <div v-else-if="isPending" class="flex flex-col gap-3" aria-hidden="true">
      <Skeleton v-for="index in 4" :key="index" height="3.5rem" border-radius="var(--radius-control)" />
    </div>
    <div v-else class="flex flex-col">
      <SettingsToggleRow
        v-for="key in keys"
        :id="`settings-notify-${key}`"
        :key="key"
        :title="t(`settings.notifications.${key}.title`)"
        :description="t(`settings.notifications.${key}.description`)"
        :checked="shown[key]"
        :disabled="saving"
        @toggle="(enabled) => toggle(key, enabled)"
      />
    </div>
  </SettingsCard>
</template>
