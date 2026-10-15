<script setup lang="ts">
import { toPercent } from '~/shared/utils/progress'

const props = withDefaults(
  defineProps<{ value: number; label: string; tone?: 'accent' | 'deep' | 'muted'; size?: 'sm' | 'md' | 'lg' }>(),
  { tone: 'accent', size: 'md' },
)

const percent = computed(() => toPercent(props.value))
const height = computed(() => ({ sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' })[props.size])
const fill = computed(() => ({ accent: 'bg-accent', deep: 'bg-deep', muted: 'bg-deep-muted' })[props.tone])
</script>

<template>
  <div
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="percent"
    aria-valuemin="0"
    aria-valuemax="100"
    class="w-full overflow-hidden rounded-full bg-track"
    :class="height"
  >
    <div class="h-full rounded-full" :class="fill" :style="{ width: `${percent}%` }" />
  </div>
</template>
