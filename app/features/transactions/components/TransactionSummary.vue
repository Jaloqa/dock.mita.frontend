<script setup lang="ts">
import type { Currency } from '~/shared/money/money'

defineProps<{ count: number; sum: number; currency: Currency }>()
const { t } = useI18n()
const { format } = useMoney()
</script>

<template>
  <section
    :aria-label="t('transactions.summary.label')"
    aria-live="polite"
    class="flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm text-muted"
  >
    <i18n-t keypath="transactions.summary.found" tag="span">
      <template #count>
        <strong class="font-semibold text-ink">{{ t('transactions.summary.count', { count }, count) }}</strong>
      </template>
    </i18n-t>
    <i18n-t keypath="transactions.summary.total" tag="span">
      <template #amount>
        <strong class="font-mono font-medium text-ink">{{ format(sum, currency, { signed: true }) }}</strong>
      </template>
    </i18n-t>
  </section>
</template>
