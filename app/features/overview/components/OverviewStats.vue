<script setup lang="ts">
import type { OverviewDto } from '~/shared/api/contract'
import { shownBalance, usedShare } from '../utils/overviewView'

const props = defineProps<{ overview?: OverviewDto; failed?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const monthLabel = useMonthLabel()
const percent = useOverviewPercent()
const { included } = useBalanceWithDebts()

const balance = computed(() => (props.overview ? shownBalance(props.overview, included.value) : undefined))

const withChange = (text: string, change: number | null) =>
  change === null ? text : t('overview.stats.withChange', { text, change: percent.change(change) })
</script>

<template>
  <section
    :aria-label="t('overview.stats.label')"
    :aria-busy="!overview && !failed"
    class="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4"
  >
    <ErrorState v-if="failed" class="col-span-full" @retry="emit('retry')" />
    <template v-else-if="overview && balance">
      <StatCard
        data-testid="overview-balance"
        variant="deep"
        :label="balance.withDebts ? t('overview.stats.balanceWithDebts') : t('overview.stats.balance')"
      >
        <MoneyText :amount="balance.amount" :currency="overview.currency" />
        <template #footer>
          {{ t('overview.stats.accounts', { count: overview.balance.accounts }, overview.balance.accounts) }}
        </template>
      </StatCard>
      <StatCard data-testid="overview-income" :label="t('overview.stats.income')">
        <MoneyText :amount="overview.income.amount" :currency="overview.currency" />
        <template #footer>
          {{
            withChange(
              t('overview.stats.incomeCount', { count: overview.income.count }, overview.income.count),
              overview.income.change,
            )
          }}
        </template>
      </StatCard>
      <StatCard data-testid="overview-expense" :label="t('overview.stats.expense')">
        <MoneyText :amount="overview.expense.amount" :currency="overview.currency" />
        <template #footer>
          {{ t('overview.stats.expenseCount', { count: overview.expense.count }, overview.expense.count) }}
        </template>
      </StatCard>
      <StatCard data-testid="overview-budget-left" :label="t('overview.stats.budgetLeft')">
        <MoneyText class="text-accent" :amount="overview.month.left" :currency="overview.currency" />
        <template #footer>
          <div class="flex flex-col gap-2">
            <ProgressBar
              v-if="overview.month.budgets > 0"
              :value="usedShare(overview.month.spent, overview.month.planned)"
              :label="t('overview.stats.budgetProgress')"
              size="sm"
            />
            <span v-if="overview.month.budgets > 0">
              {{ t('overview.stats.budgetMonth', { month: monthLabel(overview.month.period) }) }}
            </span>
            <NuxtLinkLocale
              v-else
              to="/budgets"
              class="inline-flex min-h-11 items-center font-semibold text-accent no-underline"
            >
              {{ t('overview.budgets.create') }}
            </NuxtLinkLocale>
          </div>
        </template>
      </StatCard>
    </template>
    <template v-else>
      <Skeleton v-for="index in 4" :key="index" height="8.25rem" border-radius="16px" aria-hidden="true" />
    </template>
  </section>
</template>
