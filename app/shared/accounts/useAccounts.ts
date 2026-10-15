import { useQuery } from '@tanstack/vue-query'
import { accountsApi } from './accountsApi'
import { accountKeys } from './keys'

export function useAccounts() {
  const api = accountsApi(useApi())
  const query = useQuery({ queryKey: accountKeys.list, queryFn: api.list })
  const accounts = computed(() => query.data.value?.items ?? [])

  return {
    accounts,
    activeAccounts: computed(() => accounts.value.filter((account) => !account.archived)),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
