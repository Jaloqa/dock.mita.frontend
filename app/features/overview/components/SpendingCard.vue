<script setup lang="ts">
import type { OverviewDto } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'
import { previousMonthKey, sliceColor } from '../utils/overviewView'

const props = defineProps<{ overview?: OverviewDto; failed?: boolean; compact?: boolean }>()
const emit = defineEmits<{ add: []; retry: [] }>()
const { t, n } = useI18n()
const { format } = useMoney()
const monthLabel = useMonthLabel()
const percent = useOverviewPercent()
const headingId = useId()

const slices = computed(() =>
  (props.overview?.spending ?? []).map((slice, index) => ({
    key: slice.categoryId ?? 'other',
    name: slice.name ?? t('overview.spending.other'),
    amount: slice.amount,
    percent: slice.percent,
    color: sliceColor(index, slice.categoryId === null),
  })),
)

const changeLabel = computed(() => {
  const value = props.overview
  if (!value) return ''
  if (value.range === 'month') {
    return t('overview.spending.vsMonth', { month: monthLabel(previousMonthKey(value.month.period)) })
  }
  return t(value.range === 'week' ? 'overview.spending.vsWeek' : 'overview.spending.vsYear')
})
</script>

<template>
  <section
    :aria-labelledby="headingId"
    :aria-busy="!overview && !failed"
    class="flex min-w-0 flex-col rounded-(--radius-card) bg-surface"
    :class="compact ? 'gap-4 p-4' : 'gap-5 p-5.5'"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 :id="headingId" class="m-0 text-base font-semibold">{{ t('overview.spending.title') }}</h2>
      <NuxtLinkLocale
        to="/reports"
        class="inline-flex min-h-11 items-center text-[13px] font-medium text-accent no-underline"
      >
        {{ t('overview.spending.details') }}
      </NuxtLinkLocale>
    </div>
    <ErrorState v-if="failed" compact @retry="emit('retry')" />
    <div
      v-else-if="!overview"
      class="flex items-center gap-8"
      :class="compact ? 'flex-col' : 'flex-wrap'"
      aria-hidden="true"
    >
      <Skeleton shape="circle" :size="compact ? '15rem' : '13.75rem'" class="mx-auto" />
      <div class="flex flex-col gap-3" :class="compact ? 'w-full' : 'flex-[1_1_260px]'">
        <Skeleton v-for="index in compact ? 5 : 6" :key="index" height="1.75rem" />
      </div>
    </div>
    <div v-else-if="!overview.hasTransactions" class="flex flex-col items-start gap-3">
      <p class="m-0 text-base font-semibold">{{ t('transactions.empty.title') }}</p>
      <p class="m-0 text-sm text-muted">{{ t('overview.spending.noTransactionsDescription') }}</p>
      <NuxtLinkLocale
        v-if="compact"
        to="/transactions/new"
        class="inline-flex min-h-11 items-center rounded-(--radius-control) bg-accent px-4 text-sm font-semibold text-on-accent no-underline"
      >
        {{ t('transactions.actions.addFirst') }}
      </NuxtLinkLocale>
      <Button v-else :label="t('transactions.actions.addFirst')" class="min-h-11" @click="emit('add')" />
    </div>
    <p v-else-if="slices.length === 0" class="m-0 text-sm text-muted">{{ t('overview.spending.empty') }}</p>
    <div v-else class="flex flex-auto items-center" :class="compact ? 'flex-col gap-5' : 'flex-wrap gap-8'">
      <SpendingDonut
        class="mx-auto"
        :slices="slices"
        :total="overview.expense.amount"
        :currency="overview.currency"
        :large="compact"
      />
      <ul class="m-0 min-w-0 list-none p-0" :class="compact ? 'w-full' : 'flex-[1_1_260px]'" aria-hidden="true">
        <li
          v-for="slice in slices"
          :key="slice.key"
          class="grid grid-cols-[12px_minmax(0,1fr)_auto_52px] items-center gap-3 border-t border-bg py-2.5 text-sm"
        >
          <span class="size-3 rounded-sm" :class="categorySwatchClass(slice.color)" />
          <span class="truncate font-medium">{{ slice.name }}</span>
          <span class="font-mono text-[13px] whitespace-nowrap">{{ format(slice.amount, overview.currency) }}</span>
          <span class="text-right font-mono text-[13px] text-muted">{{ percent.share(slice.percent) }}</span>
        </li>
      </ul>
      <table class="sr-only">
        <caption>
          {{ t('overview.spending.title') }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ t('overview.spending.category') }}</th>
            <th scope="col">{{ t('overview.spending.amount') }}</th>
            <th scope="col">{{ t('overview.spending.share') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="slice in slices" :key="slice.key">
            <th scope="row">{{ slice.name }}</th>
            <td>{{ format(slice.amount, overview.currency) }}</td>
            <td>{{ percent.share(slice.percent) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <dl
      v-if="overview?.hasTransactions"
      class="m-0 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4 border-t border-track pt-4.5"
    >
      <div class="flex flex-col gap-1">
        <dt class="text-xs text-muted">{{ changeLabel }}</dt>
        <dd class="m-0 font-mono text-base font-medium">
          {{ overview.expense.change === null ? t('overview.spending.none') : percent.change(overview.expense.change) }}
        </dd>
      </div>
      <div v-if="!compact" class="flex flex-col gap-1">
        <dt class="text-xs text-muted">{{ t('overview.spending.average') }}</dt>
        <dd class="m-0 font-mono text-base font-medium">
          {{
            overview.averageExpense === null
              ? t('overview.spending.none')
              : format(overview.averageExpense, overview.currency)
          }}
        </dd>
      </div>
      <div v-if="!compact" class="flex flex-col gap-1">
        <dt class="text-xs text-muted">{{ t('overview.spending.count') }}</dt>
        <dd class="m-0 font-mono text-base font-medium">{{ n(overview.transactionCount) }}</dd>
      </div>
    </dl>
  </section>
</template>
