<script setup lang="ts">
import type { TransactionDto, TransactionSort } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'
import { addDaysIso } from '~/shared/period/period'
import type { TransactionView } from '../types'
import { groupByDay, orderDayGroups, signedAmount } from '../utils/group'

const props = defineProps<{ rows: TransactionView[]; currency: Currency; sort: TransactionSort }>()
const emit = defineEmits<{ open: [transaction: TransactionDto] }>()
const { t, d } = useI18n()
const { format } = useMoney()
const today = useToday()

const groups = computed(() =>
  orderDayGroups(
    groupByDay(props.rows, (row) => row.transaction),
    props.sort,
  ),
)

const label = (date: string) => {
  if (date === today.value) return t('transactions.day.today')
  if (date === addDaysIso(today.value, -1)) return t('transactions.day.yesterday')
  const value = new Date(`${date}T00:00:00Z`)
  if (date.startsWith(today.value.slice(0, 4))) return d(value, 'dayMonth')
  return d(value, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
</script>

<template>
  <section :aria-label="t('transactions.list.label')" class="flex flex-col gap-3.5">
    <section
      v-for="group in groups"
      :key="group.date"
      :aria-labelledby="`transactions-day-${group.date}`"
      class="flex flex-col gap-1.5"
    >
      <div class="flex items-baseline justify-between gap-3 px-1 text-xs font-semibold text-muted">
        <h2 :id="`transactions-day-${group.date}`" class="m-0 text-xs font-semibold">{{ label(group.date) }}</h2>
        <span class="font-mono">{{ format(group.sum, currency, { signed: true }) }}</span>
      </div>
      <ul class="m-0 list-none rounded-(--radius-card) bg-surface px-4 py-0">
        <li v-for="(row, index) in group.items" :key="row.transaction.id" :class="{ 'border-t border-bg': index > 0 }">
          <button
            type="button"
            class="flex min-h-15 w-full items-center gap-3 py-3 text-left"
            @click="emit('open', row.transaction)"
          >
            <span
              class="flex size-9 flex-none items-center justify-center rounded-(--radius-control) bg-track text-[13px] font-bold text-ink"
              aria-hidden="true"
            >
              {{ row.initial }}
            </span>
            <span class="flex min-w-0 flex-auto flex-col gap-0.5">
              <span class="truncate text-sm font-medium text-ink">{{ row.title }}</span>
              <span class="truncate text-xs text-muted">{{ row.categoryName }}</span>
            </span>
            <MoneyText
              :amount="signedAmount(row.transaction)"
              :currency="row.transaction.currency"
              signed
              class="text-sm"
            />
          </button>
        </li>
      </ul>
    </section>
  </section>
</template>
