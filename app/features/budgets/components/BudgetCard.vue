<script setup lang="ts">
import type { BudgetDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'
import { spentShare, statusBadgeClass, statusBarTone, statusLabelKey } from '../utils/budgetView'

const props = defineProps<{ budget: BudgetDto; name: string; currency: Currency }>()
const { t } = useI18n()
const { format } = useMoney()

const headingId = computed(() => `budget-${props.budget.id}`)
const remainder = computed(() =>
  props.budget.remaining < 0
    ? t('budgets.card.overspent', { amount: format(-props.budget.remaining, props.currency) })
    : t('budgets.card.left', { amount: format(props.budget.remaining, props.currency) }),
)
</script>

<template>
  <article :aria-labelledby="headingId" class="flex flex-col gap-3.5 rounded-(--radius-card) bg-surface p-5.5">
    <div class="flex items-center justify-between gap-2">
      <h2 :id="headingId" class="m-0 min-w-0 truncate text-base font-semibold">{{ name }}</h2>
      <div class="flex shrink-0 items-center gap-1">
        <span
          class="rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
          :class="statusBadgeClass[budget.status]"
        >
          {{ t(statusLabelKey[budget.status]) }}
        </span>
        <slot name="actions" />
      </div>
    </div>
    <div class="flex flex-wrap items-baseline gap-1.5">
      <span class="font-mono text-[22px] font-medium whitespace-nowrap">{{ format(budget.spent, currency) }}</span>
      <span class="text-[13px] text-muted">{{ t('budgets.card.of', { amount: format(budget.limit, currency) }) }}</span>
    </div>
    <ProgressBar
      :value="spentShare(budget.spent, budget.limit)"
      :label="t('budgets.card.progress', { name })"
      :tone="statusBarTone(budget.status)"
    />
    <div class="flex flex-wrap justify-between gap-2 text-xs text-muted">
      <span>{{ remainder }}</span>
      <span v-if="budget.perDay !== null">
        {{ t('budgets.card.perDay', { amount: format(budget.perDay, currency) }) }}
      </span>
    </div>
  </article>
</template>
