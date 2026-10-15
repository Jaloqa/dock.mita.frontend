<script setup lang="ts">
const { t } = useI18n()

useHead({ title: () => t('navigation.goals') })
</script>

<template>
  <PageHeader :title="t('navigation.goals')" />
  <PagePlaceholder />
</template>
