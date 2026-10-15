<script setup lang="ts">
const { preference } = useColorMode()
const { t } = useI18n()

const options = computed(() => [
  { label: t('shared.theme.system'), value: 'system' },
  { label: t('shared.theme.light'), value: 'light' },
  { label: t('shared.theme.dark'), value: 'dark' },
])
</script>

<template>
  <SelectButton
    v-model="preference"
    :options="options"
    option-label="label"
    option-value="value"
    :allow-empty="false"
    :aria-label="t('shared.theme.label')"
  />
</template>
