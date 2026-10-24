import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/vue-query'
import type { GroupDto } from '~/shared/api/contract'
import { groupsApi } from '../api/groupsApi'
import { groupKeys } from '../api/keys'
import { toConfirmApi } from '../api/toConfirmApi'
import { userScope } from '../utils/scope'

export function useToConfirm() {
  const client = useApi()
  const query = useInfiniteQuery({
    queryKey: groupKeys.toConfirm,
    queryFn: ({ pageParam }: { pageParam: number }) => toConfirmApi(client).list(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last: { page: number; pageSize: number; total: number }) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  })
  const items = computed(() => query.data.value?.pages.flatMap((page) => page.items) ?? [])
  const groupIds = computed(() => [...new Set(items.value.map((item) => item.groupId))])
  const groupQueries = useQueries({
    queries: computed(() =>
      groupIds.value.map((id) => ({
        queryKey: groupKeys.group(userScope(id)),
        queryFn: () => groupsApi(client).get(userScope(id)),
      })),
    ),
  })
  const groups = computed(
    () =>
      new Map(
        groupQueries.value.flatMap((result): [string, GroupDto][] =>
          result.data ? [[result.data.id, result.data]] : [],
        ),
      ),
  )

  const groupsReady = computed(() => groupQueries.value.every((result) => !result.isPending))

  return {
    items,
    groups,
    groupsReady,
    hasMore: computed(() => query.hasNextPage.value),
    loadMore: () => query.fetchNextPage(),
    isPending: query.isPending,
    isLoadingMore: query.isFetchingNextPage,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function useToConfirmCount() {
  const client = useApi()
  const query = useQuery({ queryKey: groupKeys.toConfirmCount, queryFn: () => toConfirmApi(client).count() })

  return { count: computed(() => query.data.value ?? 0) }
}
