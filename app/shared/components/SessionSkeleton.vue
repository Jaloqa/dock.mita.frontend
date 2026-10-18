<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div
    role="status"
    aria-busy="true"
    :aria-label="t('shared.session.loading')"
    data-testid="session-skeleton"
    class="flex min-h-dvh bg-bg"
  >
    <div class="hidden w-58 shrink-0 border-r border-border bg-surface lg:block" />
    <div class="min-w-0 flex-1 px-5 pt-14 lg:px-8 lg:pt-7">
      <div class="mx-auto flex w-full max-w-310 flex-col gap-6 motion-safe:animate-pulse">
        <div class="h-8 w-48 rounded-[10px] bg-track" />
        <div class="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
          <div v-for="card in 3" :key="card" class="h-28 rounded-2xl bg-surface" />
        </div>
        <div class="h-64 rounded-[20px] bg-surface" />
      </div>
    </div>
  </div>
</template>
