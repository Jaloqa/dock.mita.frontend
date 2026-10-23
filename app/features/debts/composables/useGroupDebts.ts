import { useQuery } from '@tanstack/vue-query'
import { debtsApi } from '../api/debtsApi'
import { debtKeys } from '../api/keys'

export function useGroupDebts() {
  const api = debtsApi(useApi())
  const query = useQuery({ queryKey: debtKeys.groups, queryFn: () => api.groups() })

  return {
    items: computed(() => query.data.value?.items ?? []),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
