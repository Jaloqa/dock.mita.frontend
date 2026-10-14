<script setup lang="ts">
const colorMode = useColorMode()
const { t } = useI18n()

const items = computed(() => [
  { label: t('shared.theme.system'), value: 'system', icon: 'i-lucide-monitor' },
  { label: t('shared.theme.light'), value: 'light', icon: 'i-lucide-sun' },
  { label: t('shared.theme.dark'), value: 'dark', icon: 'i-lucide-moon' },
])
</script>

<template>
  <USelect v-model="colorMode.preference" :items="items" :aria-label="t('shared.theme.label')" class="w-40" />
</template>
