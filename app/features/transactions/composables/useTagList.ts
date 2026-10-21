import { useInfiniteQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { tagKeys } from '../api/keys'
import { tagsApi } from '../api/tagsApi'

export const TAG_LIST_PAGE_SIZE = 100

export function useTagList(enabled: MaybeRefOrGetter<boolean> = true) {
  const api = tagsApi(useApi())
  const query = useInfiniteQuery({
    queryKey: tagKeys.list,
    enabled: computed(() => toValue(enabled)),
    queryFn: ({ pageParam }) => api.list({ page: pageParam, pageSize: TAG_LIST_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  })

  return {
    tags: computed(() => query.data.value?.pages.flatMap((page) => page.items) ?? []),
    total: computed(() => query.data.value?.pages[0]?.total),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => query.fetchNextPage(),
  }
}
