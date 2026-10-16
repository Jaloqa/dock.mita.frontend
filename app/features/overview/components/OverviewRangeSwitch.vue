<script setup lang="ts">
import { type OverviewRange, overviewRanges } from '~/shared/api/contract'

const model = defineModel<OverviewRange>({ required: true })
const { t } = useI18n()

const options = computed(() => overviewRanges.map((range) => ({ value: range, label: t(`overview.range.${range}`) })))
</script>

<template>
  <SelectButton
    v-model="model"
    :options="options"
    option-label="label"
    option-value="value"
    :allow-empty="false"
    :aria-label="t('overview.range.label')"
  />
</template>
