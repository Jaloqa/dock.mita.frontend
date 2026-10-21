<script setup lang="ts">
import {
  createColumnHelper,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  type Updater,
  useTable,
} from '@tanstack/vue-table'
import type { TransactionDto, TransactionSort } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'
import type { TransactionView } from '../types'
import { signedAccountAmount, signedAmount } from '../utils/group'

const props = defineProps<{ rows: TransactionView[] }>()
const sort = defineModel<TransactionSort>('sort', { required: true })
const emit = defineEmits<{ open: [transaction: TransactionDto] }>()
const { t, d } = useI18n()
const { format } = useMoney()

const features = tableFeatures({ rowSortingFeature })
const columnHelper = createColumnHelper<typeof features, TransactionView>()
const headerKeys = {
  date: 'transactions.table.date',
  description: 'transactions.table.description',
  category: 'transactions.table.category',
  account: 'transactions.table.account',
  amount: 'transactions.table.amount',
} as const
type ColumnId = keyof typeof headerKeys

const columns = columnHelper.columns([
  columnHelper.accessor((row) => row.transaction.date, { id: 'date' satisfies ColumnId, sortDescFirst: true }),
  columnHelper.accessor('title', { id: 'description' satisfies ColumnId, enableSorting: false }),
  columnHelper.accessor('categoryName', { id: 'category' satisfies ColumnId, enableSorting: false }),
  columnHelper.accessor('accountName', { id: 'account' satisfies ColumnId, enableSorting: false }),
  columnHelper.accessor((row) => row.transaction.baseAmount, { id: 'amount' satisfies ColumnId, sortDescFirst: true }),
])

const headerLabel = (id: string) => t(headerKeys[id as ColumnId])

const toSorting = (value: TransactionSort): SortingState => [
  { id: value.endsWith('amount') ? 'amount' : 'date', desc: value.startsWith('-') },
]

function fromSorting(state: SortingState): TransactionSort {
  const [first] = state
  if (!first) return '-date'
  if (first.id === 'amount') return first.desc ? '-amount' : 'amount'
  return first.desc ? '-date' : 'date'
}

const data = computed(() => props.rows)
const state = computed(() => ({ sorting: toSorting(sort.value) }))

const table = useTable({
  features,
  columns,
  data,
  state,
  manualSorting: true,
  enableSortingRemoval: false,
  enableMultiSort: false,
  getRowId: (row: TransactionView) => row.transaction.id,
  onSortingChange: (updater: Updater<SortingState>) => {
    sort.value = fromSorting(typeof updater === 'function' ? updater(toSorting(sort.value)) : updater)
  },
})

const ariaSort = (direction: false | 'asc' | 'desc') =>
  direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined

const today = useToday()
const day = (iso: string) =>
  d(new Date(`${iso}T00:00:00Z`), {
    day: '2-digit',
    month: '2-digit',
    ...(iso.startsWith(today.value.slice(0, 4)) ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  })

const converted = (row: TransactionView) =>
  row.accountCurrency && row.accountCurrency !== row.transaction.currency
    ? t('transactions.converted', {
        amount: format(signedAccountAmount(row.transaction), row.accountCurrency, { signed: true }),
      })
    : undefined
</script>

<template>
  <section :aria-label="t('transactions.table.label')" class="overflow-x-auto rounded-(--radius-card) bg-surface">
    <table class="w-full min-w-170 border-collapse">
      <thead>
        <tr v-for="group in table.getHeaderGroups()" :key="group.id">
          <th
            v-for="header in group.headers"
            :key="header.id"
            scope="col"
            :aria-sort="ariaSort(header.column.getIsSorted())"
            class="whitespace-nowrap border-b border-border px-4 py-1 text-xs font-semibold text-muted"
            :class="header.column.id === 'amount' ? 'text-right' : 'text-left'"
          >
            <button
              v-if="header.column.getCanSort()"
              type="button"
              class="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              {{ headerLabel(header.column.id) }}
              <AppIcon
                v-if="header.column.getIsSorted()"
                :name="header.column.getIsSorted() === 'desc' ? 'arrowDown' : 'arrowUp'"
                :size="14"
              />
            </button>
            <span v-else class="inline-flex min-h-11 items-center">{{ headerLabel(header.column.id) }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          class="cursor-pointer transition-colors hover:bg-bg/60"
          @click="emit('open', row.original.transaction)"
        >
          <td class="whitespace-nowrap border-b border-bg px-4 py-3.5 font-mono text-[13px] text-muted">
            {{ day(row.original.transaction.date) }}
          </td>
          <td class="border-b border-bg px-4 py-3.5">
            <button
              type="button"
              class="text-left text-sm font-medium text-ink hover:text-accent"
              @click.stop="emit('open', row.original.transaction)"
            >
              {{ row.original.title }}
            </button>
            <span v-if="row.original.transaction.note" class="block text-xs text-muted">
              {{ row.original.transaction.note }}
            </span>
            <TransactionTagChips :tags="row.original.tags" :limit="3" class="mt-1" />
          </td>
          <td class="border-b border-bg px-4 py-3.5">
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-track px-2.5 py-1 text-xs font-semibold text-ink"
            >
              <span
                class="size-2 rounded-full"
                :class="categorySwatchClass(row.original.categoryColor)"
                aria-hidden="true"
              />
              {{ row.original.categoryName }}
            </span>
          </td>
          <td class="border-b border-bg px-4 py-3.5 text-[13px] text-muted">{{ row.original.accountName }}</td>
          <td class="whitespace-nowrap border-b border-bg px-4 py-3.5 text-right">
            <MoneyText
              :amount="signedAmount(row.original.transaction)"
              :currency="row.original.transaction.currency"
              signed
              class="text-sm"
            />
            <span v-if="converted(row.original)" class="block font-mono text-xs text-muted">
              {{ converted(row.original) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
