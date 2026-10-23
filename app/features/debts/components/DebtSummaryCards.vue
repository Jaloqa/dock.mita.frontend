<script setup lang="ts">
import type { DebtSummary } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'

defineProps<{ summary: DebtSummary; currency: Currency }>()
const { t, n } = useI18n()
</script>

<template>
  <section
    :aria-label="t('debts.summary.label')"
    class="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4"
  >
    <StatCard data-testid="debts-summary-owed-to-me" :label="t('debts.summary.owedToMe')">
      <MoneyText :amount="summary.owedToMe" :currency="currency" />
    </StatCard>
    <StatCard data-testid="debts-summary-owed-by-me" :label="t('debts.summary.owedByMe')">
      <MoneyText :amount="summary.owedByMe" :currency="currency" />
    </StatCard>
    <StatCard data-testid="debts-summary-overdue" :label="t('debts.summary.overdue')">
      <span :class="summary.overdue > 0 ? 'text-accent' : undefined">{{ n(summary.overdue) }}</span>
    </StatCard>
  </section>
</template>
