<script setup lang="ts">
const { t } = useI18n()

useHead({ title: () => t('navigation.budgets') })
</script>

<template>
  <PageHeader :title="t('navigation.budgets')" />
  <PagePlaceholder />
</template>
