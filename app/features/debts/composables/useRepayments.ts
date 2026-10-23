import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { debtsApi } from '../api/debtsApi'
import { debtKeys } from '../api/keys'

export function useRepayments(id: MaybeRefOrGetter<string>, enabled: MaybeRefOrGetter<boolean>) {
  const api = debtsApi(useApi())
  const query = useQuery({
    queryKey: computed(() => debtKeys.repayments(toValue(id))),
    queryFn: () => api.repayments(toValue(id)),
    enabled: computed(() => toValue(enabled)),
  })

  return {
    items: computed(() => query.data.value?.items ?? []),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
