import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { DebtStatus } from '~/shared/api/contract'
import { debtsApi } from '../api/debtsApi'
import { debtKeys } from '../api/keys'

export function useDebts(status: MaybeRefOrGetter<DebtStatus>) {
  const api = debtsApi(useApi())
  const query = useQuery({
    queryKey: computed(() => debtKeys.list(toValue(status))),
    queryFn: () => api.list(toValue(status)),
  })

  return {
    page: query.data,
    items: computed(() => query.data.value?.items ?? []),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
