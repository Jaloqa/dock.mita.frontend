<script setup lang="ts">
const { t } = useI18n()

useHead({ title: () => t('navigation.transactions') })
</script>

<template>
  <PageHeader :title="t('navigation.transactions')" />
  <PagePlaceholder />
</template>
