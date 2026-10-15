<script setup lang="ts">
const { t, d } = useI18n()

useHead({ title: () => t('navigation.overview') })
</script>

<template>
  <PageHeader :eyebrow="t('navigation.overview')" :title="d(new Date(), 'monthYear')" />
  <PagePlaceholder />
</template>
