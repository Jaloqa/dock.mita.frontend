<script setup lang="ts">
defineProps<{ eyebrow?: string; title: string }>()
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex flex-col gap-1">
      <span v-if="eyebrow" class="text-[13px] font-medium text-muted">{{ eyebrow }}</span>
      <h1 class="m-0 text-2xl font-bold tracking-tight lg:text-[28px]">{{ title }}</h1>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2.5">
      <slot name="actions" />
    </div>
  </header>
</template>
