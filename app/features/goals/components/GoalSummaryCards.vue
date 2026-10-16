<script setup lang="ts">
import type { GoalSummary } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'

defineProps<{ summary: GoalSummary; currency: Currency }>()
const { t, n } = useI18n()
const { format } = useMoney()
</script>

<template>
  <section
    :aria-label="t('goals.summary.label')"
    class="hidden grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-4 lg:grid"
  >
    <StatCard :label="t('goals.summary.saved')">{{ format(summary.saved, currency) }}</StatCard>
    <StatCard :label="t('goals.summary.monthly')">{{ format(summary.monthly, currency) }}</StatCard>
    <StatCard :label="t('goals.summary.active')">{{ n(summary.active) }}</StatCard>
  </section>
</template>
