<script setup lang="ts">
import type { Currency } from '~/shared/money/money'

const props = withDefaults(
  defineProps<{ amount: number; currency: Currency; signed?: boolean; tone?: 'auto' | 'plain' }>(),
  { signed: false, tone: 'auto' },
)

const { format } = useMoney()

const text = computed(() => format(props.amount, props.currency, { signed: props.signed }))
const isIncome = computed(() => props.tone === 'auto' && props.signed && props.amount > 0)
</script>

<template>
  <span class="font-mono font-medium whitespace-nowrap" :class="isIncome ? 'text-accent' : undefined">{{ text }}</span>
</template>
