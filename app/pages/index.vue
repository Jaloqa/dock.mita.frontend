<script setup lang="ts">
const { t, n } = useI18n()
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-6">
    <AppLogo :size="48" />
    <section class="flex flex-col gap-4 rounded-(--radius-card) bg-deep p-6 text-on-deep">
      <span class="text-sm text-deep-muted">{{ t('app.description') }}</span>
      <span class="font-mono text-3xl font-medium tracking-tight">{{ n(24860.4, 'currency') }}</span>
      <span class="text-xs text-deep-muted">{{ t('shared.operations', 47) }}</span>
    </section>
    <p class="text-muted">{{ t('app.comingSoon') }}</p>
    <div class="flex flex-wrap items-center gap-3">
      <LocaleSwitcher />
      <ColorModeSwitcher />
    </div>
  </main>
</template>
