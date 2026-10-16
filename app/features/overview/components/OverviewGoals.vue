<script setup lang="ts">
import type { OverviewDto, OverviewGoalDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'
import { usedShare } from '../utils/overviewView'

defineProps<{ overview?: OverviewDto; failed?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const { format } = useMoney()
const monthLabel = useMonthLabel()
const percent = useOverviewPercent()

function detailOf(goal: OverviewGoalDto, currency: Currency) {
  const amounts = t('overview.goals.amounts', {
    saved: format(goal.saved, currency),
    target: format(goal.target, currency),
  })
  if (goal.status === 'reached') return t('overview.goals.withDetail', { amounts, detail: t('overview.goals.reached') })
  if (!goal.deadline) return amounts
  const deadline = t('overview.goals.deadline', { month: monthLabel(goal.deadline, { withYear: true }) })
  return t('overview.goals.withDetail', { amounts, detail: deadline })
}
</script>

<template>
  <section
    aria-labelledby="overview-goals"
    :aria-busy="!overview && !failed"
    class="flex flex-col gap-4.5 rounded-(--radius-card) bg-surface p-5.5"
  >
    <div class="flex items-baseline justify-between gap-2">
      <h2 id="overview-goals" class="m-0 text-base font-semibold">{{ t('overview.goals.title') }}</h2>
      <NuxtLinkLocale
        to="/goals"
        class="inline-flex min-h-11 items-center text-[13px] font-medium text-accent no-underline"
      >
        {{ t('overview.goals.add') }}
      </NuxtLinkLocale>
    </div>
    <ErrorState v-if="failed" compact @retry="emit('retry')" />
    <div v-else-if="!overview" class="flex flex-col gap-4" aria-hidden="true">
      <Skeleton v-for="index in 3" :key="index" height="3.5rem" />
    </div>
    <div v-else-if="overview.goals.length === 0" class="flex flex-col items-start gap-1">
      <p class="m-0 text-sm text-muted">{{ t('overview.goals.empty') }}</p>
      <NuxtLinkLocale
        to="/goals"
        class="inline-flex min-h-11 items-center text-sm font-semibold text-accent no-underline"
      >
        {{ t('overview.goals.create') }}
      </NuxtLinkLocale>
    </div>
    <ul v-else class="m-0 flex list-none flex-col gap-4.5 p-0">
      <li v-for="goal in overview.goals" :key="goal.id" class="flex flex-col gap-2">
        <div class="flex justify-between gap-2 text-sm">
          <span class="min-w-0 truncate font-medium">{{ goal.name }}</span>
          <span class="font-mono text-[13px] text-muted">{{ percent.whole(goal.percent) }}</span>
        </div>
        <ProgressBar
          :value="usedShare(goal.saved, goal.target)"
          :label="t('overview.goals.progress', { name: goal.name })"
          tone="ink"
        />
        <span class="text-xs text-muted">{{ detailOf(goal, overview.currency) }}</span>
      </li>
    </ul>
  </section>
</template>
