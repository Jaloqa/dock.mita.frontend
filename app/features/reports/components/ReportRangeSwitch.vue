<script setup lang="ts">
import { type ReportRange, reportRangePeriods, reportRanges } from '~/shared/api/contract'

const model = defineModel<ReportRange>({ required: true })
const { t } = useI18n()

const labelOf = (range: ReportRange) => {
  const months = reportRangePeriods[range]
  return range === '12m' ? t('reports.range.year') : t('reports.range.months', { count: months }, months)
}

const options = computed(() => reportRanges.map((range) => ({ value: range, label: labelOf(range) })))
</script>

<template>
  <SelectButton
    v-model="model"
    :options="options"
    option-label="label"
    option-value="value"
    :allow-empty="false"
    :aria-label="t('reports.range.label')"
  />
</template>
