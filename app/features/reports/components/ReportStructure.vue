<script setup lang="ts">
import type { ReportDto } from '~/shared/api/contract'
import { barShare, largestOf } from '../utils/reportsView'

const props = defineProps<{ report?: ReportDto; compact?: boolean }>()
const { t } = useI18n()
const { format } = useMoney()
const monthLabel = useMonthLabel()
const percent = useReportPercent()
const headingId = useId()

const month = computed(() => (props.report ? monthLabel(props.report.structure.period) : ''))
const title = computed(() => {
  if (!props.report) return t('reports.structure.plain')
  return t(props.compact ? 'reports.structure.short' : 'reports.structure.title', { month: month.value })
})
const largest = computed(() => largestOf(props.report?.structure.items ?? []))
const width = (amount: number) => `${barShare(amount, largest.value) * 100}%`
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex break-inside-avoid flex-col rounded-(--radius-card) bg-surface print:border print:border-border"
    :class="compact ? 'gap-3 p-4' : 'gap-4 p-5.5'"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 :id="headingId" class="m-0 font-semibold" :class="compact ? 'text-[15px]' : 'text-base'">{{ title }}</h2>
      <MoneyText
        v-if="report && !compact && report.structure.items.length > 0"
        class="text-[13px] text-muted"
        :amount="report.structure.total"
        :currency="report.currency"
      />
    </div>
    <div v-if="!report" class="flex flex-col gap-3" aria-hidden="true">
      <Skeleton v-for="index in 5" :key="index" height="1.5rem" />
    </div>
    <p v-else-if="report.structure.items.length === 0" class="m-0 text-sm text-muted">
      {{ t('reports.structure.empty', { month }) }}
    </p>
    <ul v-else-if="compact" class="m-0 flex list-none flex-col gap-3 p-0">
      <li v-for="item in report.structure.items" :key="item.categoryId" class="flex flex-col gap-1.5">
        <div class="flex justify-between gap-3 text-[13px]">
          <span class="truncate font-medium">{{ item.name }}</span>
          <span class="font-mono text-muted">{{ percent.share(item.percent) }}</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-bg" aria-hidden="true">
          <div class="h-full rounded-full bg-accent" :style="{ width: width(item.amount) }" />
        </div>
      </li>
    </ul>
    <ul
      v-else
      class="m-0 grid list-none grid-cols-[140px_minmax(0,1fr)_max-content_max-content] gap-3.5 p-0"
      data-testid="report-structure-rows"
    >
      <li
        v-for="item in report.structure.items"
        :key="item.categoryId"
        class="col-span-full grid grid-cols-subgrid items-center text-sm"
      >
        <span class="truncate font-medium">{{ item.name }}</span>
        <div class="h-2.5 overflow-hidden rounded-full bg-bg" aria-hidden="true">
          <div class="h-full rounded-full bg-accent" :style="{ width: width(item.amount) }" />
        </div>
        <span class="text-right font-mono text-[13px] whitespace-nowrap">{{
          format(item.amount, report.currency)
        }}</span>
        <span class="text-right font-mono text-[13px] whitespace-nowrap text-muted">{{
          percent.share(item.percent)
        }}</span>
      </li>
    </ul>
  </section>
</template>
