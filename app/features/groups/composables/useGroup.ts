import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { isApiError } from '~/shared/api/problem'
import { groupsApi } from '../api/groupsApi'
import { groupKeys } from '../api/keys'
import type { GroupScope } from '../utils/scope'

const isMissing = (error: unknown) => isApiError(error) && error.status === 404

export function useGroup(scope: MaybeRefOrGetter<GroupScope>, options: { enabled?: MaybeRefOrGetter<boolean> } = {}) {
  const api = groupsApi(useApi())
  const { enabled } = options
  const query = useQuery({
    queryKey: computed(() => groupKeys.group(toValue(scope))),
    queryFn: () => api.get(toValue(scope)),
    retry: (failures, error) => !isMissing(error) && failures < 1,
    ...(enabled === undefined ? {} : { enabled: computed(() => toValue(enabled)) }),
  })

  return {
    group: query.data,
    isPending: query.isPending,
    isError: query.isError,
    notFound: computed(() => isMissing(query.error.value)),
    refetch: query.refetch,
  }
}
