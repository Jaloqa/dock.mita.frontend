import { useInfiniteQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { entriesApi } from '../api/entriesApi'
import { groupKeys } from '../api/keys'

export function useExpenses(deleted: MaybeRefOrGetter<boolean>) {
  const client = useApi()
  const scope = useGroupScope()
  const query = useInfiniteQuery(() => {
    const current = scope.value
    const showsDeleted = toValue(deleted)
    return {
      queryKey: groupKeys.expenses(current, showsDeleted),
      queryFn: ({ pageParam }: { pageParam: number }) => entriesApi(client, current).expenses(showsDeleted, pageParam),
      initialPageParam: 1,
      getNextPageParam: (last: { page: number; pageSize: number; total: number }) =>
        last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    }
  })

  return {
    items: computed(() => query.data.value?.pages.flatMap((page) => page.items) ?? []),
    hasMore: computed(() => query.hasNextPage.value),
    loadMore: () => query.fetchNextPage(),
    isPending: query.isPending,
    isLoadingMore: query.isFetchingNextPage,
    isError: query.isError,
    refetch: query.refetch,
  }
}
