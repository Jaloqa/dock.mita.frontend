<script setup lang="ts">
const { t } = useI18n()

useHead({ title: () => t('navigation.addTransaction') })
</script>

<template>
  <PageHeader :title="t('navigation.addTransaction')" />
  <PagePlaceholder />
</template>
