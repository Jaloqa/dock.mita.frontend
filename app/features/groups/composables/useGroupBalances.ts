import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { Currency } from '~/shared/money/currencies'
import { entriesApi } from '../api/entriesApi'
import { groupKeys } from '../api/keys'

export function useGroupBalances(currency: MaybeRefOrGetter<Currency>) {
  const client = useApi()
  const scope = useGroupScope()
  const query = useQuery(() => {
    const current = scope.value
    const viewCurrency = toValue(currency)
    return {
      queryKey: groupKeys.balances(current, viewCurrency),
      queryFn: () => entriesApi(client, current).balances(viewCurrency),
    }
  })

  return {
    balances: query.data,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
