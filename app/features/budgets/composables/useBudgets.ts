import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { budgetsApi } from '../api/budgetsApi'
import { budgetKeys } from '../api/keys'

export function useBudgets(period: MaybeRefOrGetter<string>, options: { enabled?: MaybeRefOrGetter<boolean> } = {}) {
  const api = budgetsApi(useApi())
  const query = useQuery({
    queryKey: computed(() => budgetKeys.list(toValue(period))),
    queryFn: ({ queryKey }) => api.list(queryKey[2]),
    enabled: computed(() => toValue(options.enabled ?? true)),
  })

  return {
    page: query.data,
    items: computed(() => query.data.value?.items ?? []),
    isPending: query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
  }
}
