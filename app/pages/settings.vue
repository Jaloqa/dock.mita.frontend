<script setup lang="ts">
const { t } = useI18n()

useHead({ title: () => t('navigation.settings') })
</script>

<template>
  <PageHeader :title="t('navigation.settings')" />
  <section class="flex flex-col gap-5 rounded-(--radius-card) bg-surface p-5.5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span class="text-sm font-medium">{{ t('shared.language') }}</span>
      <LocaleSwitcher />
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span class="text-sm font-medium">{{ t('shared.theme.label') }}</span>
      <ColorModeSwitcher />
    </div>
  </section>
</template>
