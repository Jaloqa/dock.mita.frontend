<script setup lang="ts">
import type { BudgetSummary } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'
import { spentShare } from '../utils/budgetView'

const props = defineProps<{ summary: BudgetSummary; currency: Currency }>()
const { t } = useI18n()
const { format } = useMoney()

const stats = computed(() => [
  { key: 'planned', label: t('budgets.summary.planned'), value: format(props.summary.planned, props.currency) },
  { key: 'spent', label: t('budgets.summary.spent'), value: format(props.summary.spent, props.currency) },
  { key: 'left', label: t('budgets.summary.left'), value: format(props.summary.left, props.currency) },
  {
    key: 'daysLeft',
    label: t('budgets.summary.daysLeft'),
    value: t('budgets.summary.days', { count: props.summary.daysLeft }, props.summary.daysLeft),
  },
])
</script>

<template>
  <section
    :aria-label="t('budgets.summary.label')"
    class="flex flex-col gap-4.5 rounded-(--radius-card) bg-deep p-6 text-on-deep"
  >
    <dl class="m-0 flex flex-wrap gap-x-8 gap-y-4">
      <div v-for="stat in stats" :key="stat.key" class="flex flex-col gap-1.5">
        <dt class="text-[13px] text-deep-muted">{{ stat.label }}</dt>
        <dd class="m-0 font-mono text-[22px] whitespace-nowrap lg:text-[26px]">{{ stat.value }}</dd>
      </div>
    </dl>
    <ProgressBar
      :value="spentShare(summary.spent, summary.planned)"
      :label="t('budgets.summary.progress')"
      tone="muted"
      track="deep"
    />
  </section>
</template>
