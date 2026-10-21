import { useAccounts } from '~/shared/accounts/useAccounts'
import type { TransactionSort } from '~/shared/api/contract'
import { useCategories } from '~/shared/categories/useCategories'
import { useUserSettings } from '~/shared/user/useUserSettings'
import type { TransactionView } from '../types'
import {
  defaultFilters,
  emptyStateOf,
  isDefaultFilters,
  isUnfilteredQuery,
  offersAllTime,
  periodKeyOf,
  shouldCheckHistory,
  type TransactionFilters,
  toQuery,
} from '../utils/filters'

export function useTransactionsScreen() {
  const settings = useUserSettings()
  const categories = useCategories()
  const accounts = useAccounts()
  const today = useToday()
  const filters = ref<TransactionFilters>(defaultFilters())
  const sort = ref<TransactionSort>('-date')
  const ready = computed(() => !settings.isPending.value && !settings.isError.value)
  const query = computed(() => toQuery(filters.value, sort.value, today.value, settings.monthStart.value))
  const list = useTransactions(query, { enabled: ready })

  const unfiltered = computed(() => isUnfilteredQuery(query.value))
  const checksHistory = computed(() =>
    shouldCheckHistory({
      ready: ready.value,
      unfiltered: unfiltered.value,
      listPending: list.isPending.value,
      listCount: list.items.value.length,
    }),
  )
  const history = useTransactions({ sort: '-date' }, { enabled: checksHistory })
  const hasHistory = computed(() => (unfiltered.value ? list.items.value.length > 0 : (history.total.value ?? 0) > 0))

  const accountsById = computed(() => new Map(accounts.accounts.value.map((account) => [account.id, account])))
  const rows = computed<TransactionView[]>(() =>
    list.items.value.map((transaction) => {
      const category = categories.byId.value.get(transaction.categoryId)
      const account = accountsById.value.get(transaction.accountId)
      const categoryName = category?.name ?? ''
      const title = transaction.title || categoryName
      return {
        transaction,
        title,
        categoryName,
        categoryColor: category?.color ?? '',
        accountName: account?.name ?? '',
        accountCurrency: account?.currency,
        initial: (categoryName || title).charAt(0).toLocaleUpperCase(),
        tags: transaction.tags.map((tag) => tag.name),
      }
    }),
  )

  const historyFailed = computed(() => checksHistory.value && history.isError.value)
  const isError = computed(
    () =>
      settings.isError.value ||
      list.isError.value ||
      categories.isError.value ||
      accounts.isError.value ||
      historyFailed.value,
  )
  const isPending = computed(
    () =>
      list.isPending.value ||
      categories.isPending.value ||
      accounts.isPending.value ||
      (checksHistory.value && history.isPending.value),
  )

  function retry() {
    if (settings.isError.value) settings.refetch()
    if (categories.isError.value) categories.refetch()
    if (accounts.isError.value) accounts.refetch()
    if (list.isError.value) list.refetch()
    if (historyFailed.value) history.refetch()
  }

  return {
    filters,
    sort,
    query,
    ready,
    rows,
    total: list.total,
    sum: list.sum,
    currency: list.currency,
    isPending,
    isError,
    isFiltered: computed(() => !isDefaultFilters(filters.value)),
    emptyState: computed(() => emptyStateOf(filters.value, hasHistory.value)),
    offersAllTime: computed(() => offersAllTime(filters.value)),
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
    retry,
    resetFilters: () => {
      filters.value = defaultFilters()
    },
    showAllTime: () => {
      filters.value.period = 'all'
    },
    categories: categories.categories,
    accounts: accounts.accounts,
    periodKey: computed(() => periodKeyOf(filters.value.period, today.value, settings.monthStart.value)),
  }
}
