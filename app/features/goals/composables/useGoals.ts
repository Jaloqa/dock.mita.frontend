import { useQuery } from '@tanstack/vue-query'
import { goalsApi } from '../api/goalsApi'
import { goalKeys } from '../api/keys'

export function useGoals() {
  const api = goalsApi(useApi())
  const query = useQuery({ queryKey: goalKeys.list, queryFn: () => api.list() })

  return {
    page: query.data,
    items: computed(() => query.data.value?.items ?? []),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
