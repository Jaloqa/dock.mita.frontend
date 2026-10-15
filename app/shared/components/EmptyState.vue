<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <section class="flex flex-col items-center gap-3 rounded-(--radius-card) bg-surface px-6 py-10 text-center">
    <h2 class="m-0 text-base font-semibold">{{ title }}</h2>
    <p v-if="description" class="m-0 max-w-sm text-sm text-muted">{{ description }}</p>
    <slot name="action" />
  </section>
</template>
