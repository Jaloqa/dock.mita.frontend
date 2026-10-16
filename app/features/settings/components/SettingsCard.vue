<script setup lang="ts">
defineProps<{ id: string; title: string }>()
</script>

<template>
  <section :aria-labelledby="`${id}-title`" class="flex flex-col gap-4 rounded-(--radius-card) bg-surface p-5.5">
    <h2 :id="`${id}-title`" class="m-0 text-base font-semibold">{{ title }}</h2>
    <slot />
  </section>
</template>
