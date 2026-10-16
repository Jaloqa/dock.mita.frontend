<script setup lang="ts">
import type { ReportDto } from '~/shared/api/contract'

const props = defineProps<{ report?: ReportDto; rangeLabel: string; compact?: boolean }>()
const { t } = useI18n()
const { format } = useMoney()
const headingId = useId()

const description = computed(() =>
  props.report
    ? t('reports.chart.label', {
        range: props.rangeLabel,
        income: format(props.report.totals.income, props.report.currency),
        expense: format(props.report.totals.expense, props.report.currency),
      })
    : '',
)
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex break-inside-avoid flex-col rounded-(--radius-card) bg-surface print:border print:border-border"
    :class="compact ? 'gap-3 p-4' : 'gap-5 p-5.5'"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 :id="headingId" class="m-0 font-semibold" :class="compact ? 'text-[15px]' : 'text-base'">
        {{ compact ? t('reports.chart.short') : t('reports.chart.title') }}
      </h2>
      <div class="flex text-muted" :class="compact ? 'gap-2.5 text-[11px]' : 'gap-4 text-[13px]'" aria-hidden="true">
        <span class="flex items-center gap-1.5">
          <span class="rounded-[3px] bg-chart-income" :class="compact ? 'size-2' : 'size-2.5'" />
          {{ compact ? t('reports.chart.incomeShort') : t('reports.chart.income') }}
        </span>
        <span class="flex items-center gap-1.5">
          <span class="rounded-[3px] bg-chart-expense" :class="compact ? 'size-2' : 'size-2.5'" />
          {{ compact ? t('reports.chart.expenseShort') : t('reports.chart.expense') }}
        </span>
      </div>
    </div>
    <ReportChart
      v-if="report"
      :periods="report.periods"
      :currency="report.currency"
      :description="description"
      :compact="compact"
    />
    <Skeleton v-else :height="compact ? '8.125rem' : '13.75rem'" aria-hidden="true" />
  </section>
</template>
