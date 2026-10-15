<script setup lang="ts">
const { t } = useI18n()

useHead({ title: () => t('navigation.accounts') })
</script>

<template>
  <PageHeader :title="t('navigation.accounts')" />
  <PagePlaceholder />
</template>
