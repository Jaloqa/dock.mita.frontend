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
    <path
      v-else-if="name === 'tools'"
      d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
    />
    <template v-else-if="name === 'debts'">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M7 5h12l-3-3M17 19H5l3 3" />
    </template>
    <template v-else-if="name === 'groups'">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20.5v-1A4.5 4.5 0 0 1 7 15h4a4.5 4.5 0 0 1 4.5 4.5v1" />
      <path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18.5 15.3a4.5 4.5 0 0 1 3 4.2v1" />
    </template>
    <template v-else-if="name === 'history'">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
      <path d="M3.5 3.5v5h5M12 7.5V12l3.2 2" />
    </template>
    <template v-else-if="name === 'settings'">
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
      />
      <circle cx="12" cy="12" r="3" />
    </template>
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <template v-else-if="name === 'calendar'">
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </template>
    <path v-else-if="name === 'transfer'" d="M7 7h12l-3-3M17 17H5l3 3" />
    <path v-else-if="name === 'edit'" d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 8.5l3 3" />
    <template v-else-if="name === 'share'">
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
    </template>
    <path v-else-if="name === 'trash'" d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    <path v-else-if="name === 'download'" d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </template>
    <path v-else-if="name === 'filter'" d="M4 6h16M7 12h10M10 18h4" />
    <path v-else-if="name === 'close'" d="M6 6l12 12M18 6L6 18" />
    <path v-else-if="name === 'arrowUp'" d="M12 19V5M6 11l6-6 6 6" />
    <path v-else-if="name === 'arrowDown'" d="M12 5v14M6 13l6 6 6-6" />
    <path v-else-if="name === 'backspace'" d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM12 9l6 6M18 9l-6 6" />
    <template v-else-if="name === 'eye'">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </template>
    <path
      v-else-if="name === 'logout'"
      d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9M15 8l4 4-4 4M19 12H9"
    />
    <template v-else-if="name === 'eyeOff'">
      <path
        d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 5.4-1.6"
      />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </template>
  </svg>
</template>
