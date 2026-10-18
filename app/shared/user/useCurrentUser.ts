import { useQuery } from '@tanstack/vue-query'
import type { ApiClient } from '~/shared/api/client'
import { useSessionStatus } from '~/shared/auth/sessionStatus'
import { userKeys } from './keys'
import { userApi } from './userApi'

export const meQueryOptions = (api: ApiClient) => ({
  queryKey: userKeys.me,
  queryFn: userApi(api).me,
  // In hybrid mode the mock transport reads the session user id from this entry, so it must outlive its observers.
  gcTime: Number.POSITIVE_INFINITY,
})

export function useCurrentUser() {
  const status = useSessionStatus()
  const query = useQuery({
    ...meQueryOptions(useApi()),
    enabled: computed(() => status.value === 'authenticated'),
  })

  return {
    user: computed(() => query.data.value),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
