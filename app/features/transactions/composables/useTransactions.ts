import { keepPreviousData, useInfiniteQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { TransactionQuery } from '~/shared/api/contract'
import { transactionKeys } from '../api/keys'
import { transactionsApi } from '../api/transactionsApi'

export const TRANSACTIONS_PAGE_SIZE = 20

export function useTransactions(
  query: MaybeRefOrGetter<TransactionQuery>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const api = transactionsApi(useApi())
  const result = useInfiniteQuery({
    queryKey: computed(() => transactionKeys.list(toValue(query))),
    queryFn: ({ pageParam, queryKey }) =>
      api.list({ ...queryKey[2], page: pageParam, pageSize: TRANSACTIONS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled: computed(() => toValue(options.enabled ?? true)),
    placeholderData: keepPreviousData,
  })
  const first = computed(() => result.data.value?.pages[0])

  return {
    items: computed(() => result.data.value?.pages.flatMap((page) => page.items) ?? []),
    total: computed(() => first.value?.total),
    sum: computed(() => first.value?.sum),
    currency: computed(() => first.value?.currency),
    isPending: result.isPending,
    isError: result.isError,
    isFetching: result.isFetching,
    refetch: result.refetch,
    hasNextPage: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    fetchNextPage: () => result.fetchNextPage(),
  }
}
