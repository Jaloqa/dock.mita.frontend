<script setup lang="ts">
withDefaults(defineProps<{ size?: number; withWordmark?: boolean }>(), {
  size: 28,
  withWordmark: true,
})
</script>

<template>
  <span class="inline-flex items-center gap-2.5">
    <svg :width="size" :height="size" viewBox="0 0 48 48" fill="none" role="img" aria-label="Mita">
      <path d="M14 9.1L34 14.7" class="stroke-logo-stroke" stroke-width="4.5" stroke-linecap="round" />
      <path d="M13 20.1L35 26.3" class="stroke-logo-stroke" stroke-width="4.5" stroke-linecap="round" />
      <path d="M10 31.1L38 38.9" class="stroke-accent" stroke-width="4.5" stroke-linecap="round" />
    </svg>
    <span v-if="withWordmark" aria-hidden="true" class="text-[17px] font-bold tracking-tight text-ink">Mita</span>
  </span>
</template>
