import { useInfiniteQuery } from '@tanstack/vue-query'
import { transferKeys } from '../api/keys'
import { transfersApi } from '../api/transfersApi'

export const TRANSFERS_PAGE_SIZE = 10

export function useTransfers() {
  const api = transfersApi(useApi())
  const query = useInfiniteQuery({
    queryKey: transferKeys.list,
    queryFn: ({ pageParam }) => api.list({ page: pageParam, pageSize: TRANSFERS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  })

  return {
    items: computed(() => query.data.value?.pages.flatMap((page) => page.items) ?? []),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => query.fetchNextPage(),
  }
}
