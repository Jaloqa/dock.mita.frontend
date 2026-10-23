import { useQuery } from '@tanstack/vue-query'
import { groupsApi } from '../api/groupsApi'
import { groupKeys } from '../api/keys'

export function useGroupInvites() {
  const api = groupsApi(useApi())
  const query = useQuery({ queryKey: groupKeys.invites, queryFn: () => api.invites() })

  return {
    items: computed(() => query.data.value?.items ?? []),
    isError: query.isError,
    refetch: query.refetch,
  }
}
