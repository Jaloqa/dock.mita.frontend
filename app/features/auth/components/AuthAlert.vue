<script setup lang="ts">
defineProps<{ message: string }>()
</script>

<template>
  <p
    role="alert"
    class="m-0 rounded-(--radius-control) border border-accent/40 bg-accent/10 px-3.5 py-3 text-sm font-medium text-ink"
  >
    {{ message }}
  </p>
</template>
