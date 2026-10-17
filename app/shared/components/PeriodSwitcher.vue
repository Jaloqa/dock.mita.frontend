<script setup lang="ts">
import { type MonthStart, periodByKey, shiftPeriod } from '~/shared/period/period'

const props = defineProps<{ monthStart: MonthStart }>()
const model = defineModel<string>({ required: true })
const { t, d } = useI18n()
const monthLabel = useMonthLabel()

const options = computed(() =>
  [-1, 0, 1].map((offset) => {
    const key = shiftPeriod(model.value, offset, props.monthStart).key
    return { value: key, label: monthLabel(key, { capitalize: true }) }
  }),
)

const range = computed(() => periodByKey(model.value, props.monthStart))

const day = (iso: string) => d(new Date(`${iso}T00:00:00Z`), { day: 'numeric', month: 'short', timeZone: 'UTC' })

const rangeTitle = computed(() => t('shared.period.range', { from: day(range.value.from), to: day(range.value.to) }))
</script>

<template>
  <SelectButton
    v-model="model"
    :options="options"
    option-label="label"
    option-value="value"
    :allow-empty="false"
    :aria-label="t('shared.period.label')"
    :title="rangeTitle"
  />
</template>
