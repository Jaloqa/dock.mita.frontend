<script setup lang="ts">
import type { IconName } from '~/shared/types/icon'

withDefaults(defineProps<{ name: IconName; size?: number; strokeWidth?: number }>(), {
  size: 18,
  strokeWidth: 1.8,
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'overview'">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </template>
    <path v-else-if="name === 'transactions'" d="M7 7h13M7 12h13M7 17h13M3.5 7h.01M3.5 12h.01M3.5 17h.01" />
    <template v-else-if="name === 'budgets'">
      <path d="M21 12a9 9 0 1 1-9-9v9z" />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
    </template>
    <template v-else-if="name === 'goals'">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </template>
    <template v-else-if="name === 'accounts'">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </template>
    <path v-else-if="name === 'reports'" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"
      />
    </template>
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <template v-else-if="name === 'calendar'">
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </template>
    <path v-else-if="name === 'transfer'" d="M7 7h12l-3-3M17 17H5l3 3" />
    <path v-else-if="name === 'edit'" d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 8.5l3 3" />
    <path v-else-if="name === 'trash'" d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
</template>
