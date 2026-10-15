<script setup lang="ts">
withDefaults(defineProps<{ label: string; variant?: 'surface' | 'deep' }>(), { variant: 'surface' })
</script>

<template>
  <div
    class="flex flex-col gap-3.5 rounded-(--radius-card) px-5.5 py-5"
    :class="variant === 'deep' ? 'bg-deep text-on-deep' : 'bg-surface text-ink'"
  >
    <span class="text-[13px] font-medium" :class="variant === 'deep' ? 'text-deep-muted' : 'text-muted'">
      {{ label }}
    </span>
    <span class="font-mono text-[28px] font-medium tracking-tight">
      <slot />
    </span>
    <div v-if="$slots.footer" class="text-xs" :class="variant === 'deep' ? 'text-deep-muted' : 'text-muted'">
      <slot name="footer" />
    </div>
  </div>
</template>
