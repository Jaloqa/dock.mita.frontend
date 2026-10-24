import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { entriesApi } from '../api/entriesApi'
import { groupKeys } from '../api/keys'
import type { GroupScope } from '../utils/scope'

export function useOpenShares(scope: MaybeRefOrGetter<GroupScope>, enabled: MaybeRefOrGetter<boolean>) {
  const client = useApi()
  const query = useQuery({
    queryKey: computed(() => groupKeys.openShares(toValue(scope))),
    queryFn: () => entriesApi(client, toValue(scope)).openShares(),
    enabled: computed(() => toValue(enabled)),
  })

  return { shares: computed(() => query.data.value ?? []) }
}
