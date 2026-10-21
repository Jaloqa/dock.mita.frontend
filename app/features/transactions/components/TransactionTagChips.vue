<script setup lang="ts">
import { visibleTags } from '../utils/tags'

const props = defineProps<{ tags: string[]; limit: number }>()
const { t } = useI18n()
const visible = computed(() => visibleTags(props.tags, props.limit))
</script>

<template>
  <ul v-if="tags.length > 0" :aria-label="t('transactions.tags.label')" class="m-0 flex list-none flex-wrap gap-1 p-0">
    <li
      v-for="name in visible.shown"
      :key="name"
      class="max-w-40 truncate rounded-full bg-track px-2 py-0.5 text-xs font-medium text-muted"
    >
      {{ name }}
    </li>
    <li v-if="visible.hidden > 0" class="rounded-full bg-track px-2 py-0.5 text-xs font-medium text-muted">
      {{ t('transactions.tags.more', { count: visible.hidden }, visible.hidden) }}
    </li>
  </ul>
</template>
