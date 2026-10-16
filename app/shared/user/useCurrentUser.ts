import { useQuery } from '@tanstack/vue-query'
import { userKeys } from './keys'
import { userApi } from './userApi'

export function useCurrentUser() {
  const api = userApi(useApi())
  const query = useQuery({ queryKey: userKeys.me, queryFn: api.me })

  return {
    user: computed(() => query.data.value),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
