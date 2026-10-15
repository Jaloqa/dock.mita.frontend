<script setup lang="ts">
const { t } = useI18n()

useHead({ title: () => t('navigation.reports') })
</script>

<template>
  <PageHeader :title="t('navigation.reports')" />
  <PagePlaceholder />
</template>
