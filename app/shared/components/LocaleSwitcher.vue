<script setup lang="ts">
const { locale, locales, setLocale, t } = useI18n()

const options = computed(() => locales.value.map((l) => ({ label: l.name ?? l.code, value: l.code })))
</script>

<template>
  <Select
    :model-value="locale"
    :options="options"
    option-label="label"
    option-value="value"
    :aria-label="t('shared.language')"
    class="w-44"
    @update:model-value="setLocale"
  />
</template>
