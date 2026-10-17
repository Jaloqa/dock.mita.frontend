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
    bucket: slice.categoryId === null,
    color: sliceColor(index, slice.categoryId === null),
  })),
)

const MOBILE_CATEGORIES = 4
const mobileSlices = computed(() => {
  const named = slices.value.filter((slice) => !slice.bucket)
  const rest = [...named.slice(MOBILE_CATEGORIES), ...slices.value.filter((slice) => slice.bucket)]
  const top = named.slice(0, MOBILE_CATEGORIES)
  if (rest.length <= 1) return [...top, ...rest]
  return [
    ...top,
    {
      key: 'other',
      name: t('overview.spending.other'),
      amount: rest.reduce((sum, slice) => sum + slice.amount, 0),
      percent: rest.reduce((sum, slice) => sum + slice.percent, 0),
      bucket: true,
      color: sliceColor(0, true),
    },
  ]
})
const shownSlices = computed(() => (props.compact ? mobileSlices.value : slices.value))

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
      class="flex items-center"
      :class="compact ? 'gap-3' : 'flex-wrap gap-8'"
      aria-hidden="true"
    >
      <Skeleton shape="circle" :size="compact ? '9rem' : '13.75rem'" :class="compact ? 'shrink-0' : 'mx-auto'" />
      <div class="flex flex-col gap-3" :class="compact ? 'min-w-0 flex-1' : 'flex-[1_1_260px]'">
        <Skeleton v-for="index in compact ? 5 : 6" :key="index" :height="compact ? '1.25rem' : '1.75rem'" />
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
    <div v-else class="flex flex-auto items-center" :class="compact ? 'gap-3' : 'flex-wrap gap-8'">
      <SpendingDonut
        :class="compact ? undefined : 'mx-auto'"
        :slices="shownSlices"
        :total="overview.expense.amount"
        :currency="overview.currency"
        :compact="compact"
      />
      <ul v-if="compact" class="m-0 flex min-w-0 flex-1 list-none flex-col gap-2 p-0" aria-hidden="true">
        <li
          v-for="slice in shownSlices"
          :key="slice.key"
          class="grid grid-cols-[10px_minmax(0,1fr)] items-center gap-x-2 text-[13px] leading-[18px]"
        >
          <span class="size-2.5 rounded-sm" :class="categorySwatchClass(slice.color)" />
          <span class="truncate font-medium">{{ slice.name }}</span>
          <span class="col-start-2 font-mono text-[11px] leading-[15px] whitespace-nowrap text-muted">
            {{ format(slice.amount, overview.currency) }}
          </span>
        </li>
      </ul>
      <ul v-else class="m-0 min-w-0 flex-[1_1_260px] list-none p-0" aria-hidden="true">
        <li
          v-for="slice in shownSlices"
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
          <tr v-for="slice in shownSlices" :key="slice.key">
            <th scope="row">{{ slice.name }}</th>
            <td>{{ format(slice.amount, overview.currency) }}</td>
            <td>{{ percent.share(slice.percent) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <dl
      v-if="overview?.hasTransactions && !compact"
      class="m-0 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4 border-t border-track pt-4.5"
    >
      <div class="flex flex-col gap-1">
        <dt class="text-xs text-muted">{{ changeLabel }}</dt>
        <dd class="m-0 font-mono text-base font-medium">
          {{ overview.expense.change === null ? t('overview.spending.none') : percent.change(overview.expense.change) }}
        </dd>
      </div>
      <div class="flex flex-col gap-1">
        <dt class="text-xs text-muted">{{ t('overview.spending.average') }}</dt>
        <dd class="m-0 font-mono text-base font-medium">
          {{
            overview.averageExpense === null
              ? t('overview.spending.none')
              : format(overview.averageExpense, overview.currency)
          }}
        </dd>
      </div>
      <div class="flex flex-col gap-1">
        <dt class="text-xs text-muted">{{ t('overview.spending.count') }}</dt>
        <dd class="m-0 font-mono text-base font-medium">{{ n(overview.transactionCount) }}</dd>
      </div>
    </dl>
  </section>
</template>
