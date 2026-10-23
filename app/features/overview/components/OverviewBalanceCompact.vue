<script setup lang="ts">
import type { OverviewDto } from '~/shared/api/contract'
import { shownBalance } from '../utils/overviewView'

const props = defineProps<{ overview?: OverviewDto; failed?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const { included } = useBalanceWithDebts()

const balance = computed(() => (props.overview ? shownBalance(props.overview, included.value) : undefined))
</script>

<template>
  <section
    :aria-label="t('overview.stats.label')"
    :aria-busy="!overview && !failed"
    class="flex min-w-0 flex-col gap-3 rounded-(--radius-card) p-4"
    :class="overview ? 'bg-deep text-on-deep' : 'bg-surface'"
  >
    <ErrorState v-if="failed" compact @retry="emit('retry')" />
    <template v-else-if="overview && balance">
      <div class="flex items-baseline justify-between gap-3">
        <span class="text-[13px] font-medium text-deep-muted">
          {{ balance.withDebts ? t('overview.stats.balanceWithDebts') : t('overview.mobile.balance') }}
        </span>
        <MoneyText
          data-testid="mobile-balance"
          class="text-2xl tracking-tight"
          :amount="balance.amount"
          :currency="overview.currency"
        />
      </div>
      <div class="flex items-baseline justify-between gap-3 border-t border-on-deep/15 pt-3 text-sm">
        <span class="flex items-baseline gap-2">
          <span class="text-xs text-deep-muted">{{ t('overview.stats.income') }}</span>
          <MoneyText
            data-testid="mobile-income"
            class="text-accent"
            signed
            :amount="overview.income.amount"
            :currency="overview.currency"
          />
        </span>
        <span class="flex items-baseline gap-2">
          <span class="text-xs text-deep-muted">{{ t('overview.stats.expense') }}</span>
          <MoneyText
            data-testid="mobile-expense"
            signed
            tone="plain"
            :amount="-overview.expense.amount"
            :currency="overview.currency"
          />
        </span>
      </div>
    </template>
    <div v-else class="flex flex-col gap-3" aria-hidden="true">
      <Skeleton height="2rem" />
      <Skeleton height="1.25rem" />
    </div>
  </section>
</template>
