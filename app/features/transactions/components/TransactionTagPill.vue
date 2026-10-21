<script setup lang="ts">
defineProps<{ name: string }>()
defineEmits<{ remove: [event: Event] }>()
const { t } = useI18n()
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-full bg-track py-0.5 ps-3 pe-1 text-sm font-medium text-ink">
    {{ name }}
    <button
      type="button"
      class="relative inline-flex size-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      :aria-label="t('transactions.tags.remove', { name })"
      @click="$emit('remove', $event)"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </span>
</template>
