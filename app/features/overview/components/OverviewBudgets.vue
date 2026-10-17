<script setup lang="ts">
import type { OverviewDto } from '~/shared/api/contract'
import { budgetTone, usedShare } from '../utils/overviewView'

const props = defineProps<{ overview?: OverviewDto; failed?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const { format } = useMoney()
const monthLabel = useMonthLabel()

const items = computed(() => (props.overview?.topBudgets ?? []).slice(0, 5))
const title = computed(() =>
  props.overview
    ? t('overview.budgets.title', { month: monthLabel(props.overview.month.period) })
    : t('overview.budgets.short'),
)
</script>

<template>
  <section
    aria-labelledby="overview-budgets"
    :aria-busy="!overview && !failed"
    class="flex flex-col gap-4.5 rounded-(--radius-card) bg-surface p-5.5"
  >
    <div class="flex items-baseline justify-between gap-2">
      <h2 id="overview-budgets" class="m-0 text-base font-semibold">{{ title }}</h2>
      <NuxtLinkLocale
        to="/budgets"
        class="inline-flex min-h-11 items-center text-[13px] font-medium text-accent no-underline"
      >
        {{ t('overview.budgets.edit') }}
      </NuxtLinkLocale>
    </div>
    <ErrorState v-if="failed" compact @retry="emit('retry')" />
    <div v-else-if="!overview" class="flex flex-col gap-4" aria-hidden="true">
      <Skeleton v-for="index in 5" :key="index" height="2.25rem" />
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
    <ul v-else class="m-0 flex flex-1 list-none flex-col justify-around gap-4.5 p-0">
      <li v-for="budget in items" :key="budget.id" class="flex flex-col gap-2">
        <div class="flex justify-between gap-2 text-sm">
          <span class="min-w-0 truncate font-medium">{{ budget.name }}</span>
          <span class="font-mono text-[13px] whitespace-nowrap text-muted">
            {{
              t('overview.budgets.amounts', {
                spent: format(budget.spent, overview.currency),
                limit: format(budget.limit, overview.currency),
              })
            }}
          </span>
        </div>
        <ProgressBar
          :value="usedShare(budget.spent, budget.limit)"
          :label="t('overview.budgets.progress', { name: budget.name })"
          :tone="budgetTone(budget.status)"
          size="md"
        />
      </li>
    </ul>
  </section>
</template>
