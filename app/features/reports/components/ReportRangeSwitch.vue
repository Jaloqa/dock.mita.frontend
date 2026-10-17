<script setup lang="ts">
import { type ReportRange, reportRangePeriods, reportRanges } from '~/shared/api/contract'

const model = defineModel<ReportRange>({ required: true })
const { t } = useI18n()

const optionOf = (range: ReportRange) => {
  const months = reportRangePeriods[range]
  if (range === '12m') return { value: range, label: t('reports.range.year'), short: t('reports.range.year') }
  return {
    value: range,
    label: t('reports.range.months', { count: months }, months),
    short: t('reports.range.monthsShort', { count: months }),
  }
}

const options = computed(() => reportRanges.map(optionOf))
</script>

<template>
  <SelectButton
    class="mita-segmented"
    v-model="model"
    :options="options"
    option-label="label"
    option-value="value"
    :allow-empty="false"
    :aria-label="t('reports.range.label')"
  >
    <template #option="{ option }">
      <span aria-hidden="true">{{ option.short }}</span>
      <span class="sr-only">{{ option.label }}</span>
    </template>
  </SelectButton>
</template>
