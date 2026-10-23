import { useQuery } from '@tanstack/vue-query'
import { groupsApi } from '../api/groupsApi'
import { groupKeys } from '../api/keys'

export function useGroups() {
  const api = groupsApi(useApi())
  const query = useQuery({ queryKey: groupKeys.list, queryFn: () => api.list() })

  return {
    items: computed(() => query.data.value?.items ?? []),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
