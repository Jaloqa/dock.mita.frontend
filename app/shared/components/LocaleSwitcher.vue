<script setup lang="ts">
const { locale, locales, setLocale, t } = useI18n()

const items = computed(() => locales.value.map((l) => ({ label: l.name ?? l.code, value: l.code })))
</script>

<template>
  <USelect
    :model-value="locale"
    :items="items"
    :aria-label="t('shared.language')"
    icon="i-lucide-languages"
    class="w-40"
    @update:model-value="setLocale"
  />
</template>
