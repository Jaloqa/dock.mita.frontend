<script setup lang="ts">
import type { OverviewDto } from '~/shared/api/contract'
import { usedShare } from '../utils/overviewView'

const props = defineProps<{ overview?: OverviewDto; failed?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()

const hasBudgets = computed(() => (props.overview?.month.budgets ?? 0) > 0)
</script>

<template>
  <section
    v-if="failed"
    aria-labelledby="overview-mobile-balance"
    class="flex flex-col gap-2 rounded-(--radius-panel) bg-surface p-5"
  >
    <h2 id="overview-mobile-balance" class="m-0 text-[13px] font-normal text-muted">
      {{ t('overview.mobile.leftThisMonth') }}
    </h2>
    <ErrorState compact @retry="emit('retry')" />
  </section>
  <div v-else-if="!overview" class="flex flex-col gap-4.5" aria-busy="true">
    <Skeleton height="11.5rem" border-radius="20px" />
    <Skeleton height="3.25rem" border-radius="16px" />
  </div>
  <template v-else>
    <section
      aria-labelledby="overview-mobile-balance"
      class="flex flex-col gap-4 rounded-(--radius-panel) bg-deep p-5 text-on-deep"
    >
      <div class="flex flex-col gap-1.5">
        <h2 id="overview-mobile-balance" class="m-0 text-[13px] font-normal text-deep-muted">
          {{ hasBudgets ? t('overview.mobile.leftThisMonth') : t('overview.mobile.balance') }}
        </h2>
        <MoneyText
          class="text-[32px] tracking-tight"
          :amount="hasBudgets ? overview.month.left : overview.balance.amount"
          :currency="overview.currency"
        />
      </div>
      <ProgressBar
        v-if="hasBudgets"
        :value="usedShare(overview.month.spent, overview.month.planned)"
        :label="t('overview.stats.budgetProgress')"
        tone="muted"
        track="deep"
        size="sm"
      />
      <dl class="m-0 grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-0.5">
          <dt class="text-xs text-deep-muted">{{ t('overview.mobile.income') }}</dt>
          <dd class="m-0">
            <MoneyText class="text-[15px]" :amount="overview.income.amount" :currency="overview.currency" />
          </dd>
        </div>
        <div class="flex flex-col gap-0.5">
          <dt class="text-xs text-deep-muted">{{ t('overview.mobile.expense') }}</dt>
          <dd class="m-0">
            <MoneyText class="text-[15px]" :amount="overview.expense.amount" :currency="overview.currency" />
          </dd>
        </div>
      </dl>
    </section>
    <div
      v-if="hasBudgets"
      data-testid="overview-per-day"
      class="flex items-center justify-between gap-3 rounded-(--radius-card) bg-surface px-4 py-3.5"
    >
      <span class="text-sm text-muted">{{ t('overview.mobile.perDay') }}</span>
      <span v-if="overview.month.perDay === null" class="font-mono text-base text-muted">
        {{ t('overview.spending.none') }}
      </span>
      <MoneyText v-else class="text-base text-accent" :amount="overview.month.perDay" :currency="overview.currency" />
    </div>
  </template>
</template>
