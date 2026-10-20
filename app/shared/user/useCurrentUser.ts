import { useQuery } from '@tanstack/vue-query'
import type { ApiClient } from '~/shared/api/client'
import { useSessionStatus } from '~/shared/auth/sessionStatus'
import { userKeys } from './keys'
import { userApi } from './userApi'

export const meQueryOptions = (api: ApiClient) => ({
  queryKey: userKeys.me,
  queryFn: userApi(api).me,
  // The auth middleware treats a missing entry as an unknown session, so it must outlive its observers.
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
