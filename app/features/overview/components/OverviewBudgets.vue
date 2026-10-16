<script setup lang="ts">
import type { OverviewDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'
import { budgetTone, usedShare } from '../utils/overviewView'

const props = defineProps<{ overview?: OverviewDto; failed?: boolean; variant: 'full' | 'compact' }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const { format } = useMoney()
const monthLabel = useMonthLabel()

const full = computed(() => props.variant === 'full')
const headingId = computed(() => `overview-budgets-${props.variant}`)
const items = computed(() => (props.overview?.topBudgets ?? []).slice(0, full.value ? 5 : 3))
const title = computed(() =>
  full.value && props.overview
    ? t('overview.budgets.title', { month: monthLabel(props.overview.month.period) })
    : t('overview.budgets.short'),
)

const remainder = (remaining: number, currency: Currency) =>
  remaining < 0
    ? t('overview.budgets.overspent', { amount: format(-remaining, currency) })
    : t('overview.budgets.left', { amount: format(remaining, currency) })
</script>

<template>
  <section
    :aria-labelledby="headingId"
    :aria-busy="!overview && !failed"
    class="flex flex-col rounded-(--radius-card) bg-surface"
    :class="full ? 'gap-4.5 p-5.5' : 'gap-3.5 p-4'"
  >
    <div class="flex items-baseline justify-between gap-2">
      <h2 :id="headingId" class="m-0 font-semibold" :class="full ? 'text-base' : 'text-[15px]'">{{ title }}</h2>
      <NuxtLinkLocale
        to="/budgets"
        class="inline-flex min-h-11 items-center text-[13px] font-medium text-accent no-underline"
      >
        {{ full ? t('overview.budgets.edit') : t('overview.budgets.all') }}
      </NuxtLinkLocale>
    </div>
    <ErrorState v-if="failed" compact @retry="emit('retry')" />
    <div v-else-if="!overview" class="flex flex-col gap-4" aria-hidden="true">
      <Skeleton v-for="index in full ? 5 : 3" :key="index" height="2.25rem" />
    </div>
    <div v-else-if="items.length === 0" class="flex flex-col items-start gap-1">
      <p class="m-0 text-sm text-muted">{{ t('overview.budgets.empty') }}</p>
      <NuxtLinkLocale
        to="/budgets"
        class="inline-flex min-h-11 items-center text-sm font-semibold text-accent no-underline"
      >
        {{ t('overview.budgets.create') }}
      </NuxtLinkLocale>
    </div>
    <ul v-else class="m-0 flex list-none flex-col p-0" :class="full ? 'gap-4.5' : 'gap-3.5'">
      <li v-for="budget in items" :key="budget.id" class="flex flex-col" :class="full ? 'gap-2' : 'gap-1.5'">
        <div class="flex justify-between gap-2" :class="full ? 'text-sm' : 'text-[13px]'">
          <span class="min-w-0 truncate font-medium">{{ budget.name }}</span>
          <span class="font-mono whitespace-nowrap text-muted" :class="full ? 'text-[13px]' : undefined">
            {{
              full
                ? t('overview.budgets.amounts', {
                    spent: format(budget.spent, overview.currency),
                    limit: format(budget.limit, overview.currency),
                  })
                : remainder(budget.remaining, overview.currency)
            }}
          </span>
        </div>
        <ProgressBar
          :value="usedShare(budget.spent, budget.limit)"
          :label="t('overview.budgets.progress', { name: budget.name })"
          :tone="budgetTone(budget.status)"
          :size="full ? 'md' : 'sm'"
        />
      </li>
    </ul>
  </section>
</template>
