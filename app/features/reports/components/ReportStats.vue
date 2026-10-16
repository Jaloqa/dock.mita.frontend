<script setup lang="ts">
import type { ReportDto } from '~/shared/api/contract'

defineProps<{ report?: ReportDto; variant: 'full' | 'compact' }>()
const { t } = useI18n()
const percent = useReportPercent()

const rate = (value: number | null) => (value === null ? t('reports.stats.none') : percent.whole(value))
</script>

<template>
  <section
    v-if="variant === 'full'"
    :aria-label="t('reports.stats.label')"
    :aria-busy="!report"
    class="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4"
  >
    <template v-if="report">
      <StatCard
        data-testid="report-average-income"
        class="break-inside-avoid print:border print:border-border"
        :label="t('reports.stats.averageIncome')"
      >
        <MoneyText :amount="report.averageIncome" :currency="report.currency" />
      </StatCard>
      <StatCard
        data-testid="report-average-expense"
        class="break-inside-avoid print:border print:border-border"
        :label="t('reports.stats.averageExpense')"
      >
        <MoneyText :amount="report.averageExpense" :currency="report.currency" />
      </StatCard>
      <StatCard
        data-testid="report-savings-rate"
        class="break-inside-avoid print:border print:border-border"
        :label="t('reports.stats.savingsRate')"
      >
        <span class="text-accent">{{ rate(report.savingsRate) }}</span>
      </StatCard>
    </template>
    <template v-else>
      <Skeleton v-for="index in 3" :key="index" height="6.5rem" border-radius="16px" aria-hidden="true" />
    </template>
  </section>
  <section v-else :aria-label="t('reports.stats.label')" :aria-busy="!report" class="grid grid-cols-2 gap-2.5">
    <template v-if="report">
      <div data-testid="report-average-expense" class="flex flex-col gap-1.5 rounded-(--radius-card) bg-surface p-3.5">
        <span class="text-xs text-muted">{{ t('reports.stats.averageExpense') }}</span>
        <MoneyText class="text-lg" :amount="report.averageExpense" :currency="report.currency" />
      </div>
      <div data-testid="report-savings-rate" class="flex flex-col gap-1.5 rounded-(--radius-card) bg-surface p-3.5">
        <span class="text-xs text-muted">{{ t('reports.stats.savings') }}</span>
        <span class="font-mono text-lg font-medium text-accent">{{ rate(report.savingsRate) }}</span>
      </div>
    </template>
    <template v-else>
      <Skeleton v-for="index in 2" :key="index" height="4.5rem" border-radius="16px" aria-hidden="true" />
    </template>
  </section>
</template>
