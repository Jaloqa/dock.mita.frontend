import { useInfiniteQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { GroupEntryEvent, GroupExpenseState, GroupRepaymentState, Page } from '~/shared/api/contract'
import { entriesApi } from '../api/entriesApi'
import { groupKeys } from '../api/keys'

export type EntryKind = 'expenses' | 'repayments'

export type EntryEvent = GroupEntryEvent<GroupExpenseState | GroupRepaymentState>

export function useEntryHistory(kind: MaybeRefOrGetter<EntryKind>, entryId: MaybeRefOrGetter<string | undefined>) {
  const client = useApi()
  const scope = useGroupScope()
  const query = useInfiniteQuery(() => {
    const current = scope.value
    const entryKind = toValue(kind)
    const id = toValue(entryId)
    const api = entriesApi(client, current)
    return {
      queryKey: groupKeys.history(current, entryKind, id ?? ''),
      queryFn: ({ pageParam }: { pageParam: number }): Promise<Page<EntryEvent>> =>
        entryKind === 'expenses' ? api.expenseHistory(id ?? '', pageParam) : api.repaymentHistory(id ?? '', pageParam),
      enabled: id !== undefined,
      initialPageParam: 1,
      getNextPageParam: (last: Page<EntryEvent>) =>
        last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    }
  })

  return {
    events: computed<EntryEvent[]>(() => query.data.value?.pages.flatMap((page) => page.items) ?? []),
    hasMore: computed(() => query.hasNextPage.value),
    loadMore: () => query.fetchNextPage(),
    isPending: query.isPending,
    isLoadingMore: query.isFetchingNextPage,
    isError: query.isError,
    refetch: query.refetch,
  }
}
