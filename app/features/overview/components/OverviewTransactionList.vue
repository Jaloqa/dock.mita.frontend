<script setup lang="ts">
import type { OverviewTransactionDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'
import { dayLabelOf, initialOf } from '../utils/overviewView'

const props = defineProps<{
  items: OverviewTransactionDto[]
  currency: Currency
  meta: 'date' | 'account'
  today: string
}>()
const { t, d } = useI18n()

const titleOf = (item: OverviewTransactionDto) => item.title || item.categoryName

function whenOf(date: string) {
  const label = dayLabelOf(date, props.today)
  if (label !== 'date') return t(`overview.recent.${label}`)
  return d(new Date(`${date}T00:00:00Z`), { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const metaOf = (item: OverviewTransactionDto) =>
  t('overview.recent.meta', {
    category: item.categoryName,
    detail: props.meta === 'date' ? whenOf(item.date) : item.accountName,
  })
</script>

<template>
  <ul class="m-0 flex list-none flex-col p-0">
    <li v-for="item in items" :key="item.id" class="flex items-center gap-3 border-t border-bg py-2.5">
      <span
        class="flex size-9 shrink-0 items-center justify-center rounded-(--radius-control) bg-track text-[13px] font-bold text-ink"
        aria-hidden="true"
      >
        {{ initialOf(titleOf(item)) }}
      </span>
      <div class="flex min-w-0 flex-auto flex-col gap-0.5">
        <span class="truncate text-sm font-medium">{{ titleOf(item) }}</span>
        <span class="truncate text-xs text-muted">{{ metaOf(item) }}</span>
      </div>
      <MoneyText
        class="text-sm"
        :amount="item.kind === 'income' ? item.amount : -item.amount"
        :currency="currency"
        signed
      />
    </li>
  </ul>
</template>
