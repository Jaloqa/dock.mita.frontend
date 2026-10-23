import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { Currency } from '~/shared/money/money'
import { rateFrom, toBaseAmount } from './convert'
import { rateKeys } from './keys'
import { ratesApi } from './ratesApi'

export function useRates(
  to: MaybeRefOrGetter<Currency>,
  options: {
    date?: MaybeRefOrGetter<string | undefined>
    enabled?: MaybeRefOrGetter<boolean>
    path?: MaybeRefOrGetter<string | undefined>
  } = {},
) {
  const api = ratesApi(useApi())
  const query = useQuery({
    queryKey: computed(() => rateKeys.table(toValue(to), toValue(options.date), toValue(options.path))),
    queryFn: () => api.list({ to: toValue(to), date: toValue(options.date) }, toValue(options.path)),
    enabled: computed(() => toValue(options.enabled ?? true)),
    staleTime: 10 * 60_000,
  })
  const loaded = () => query.data.value

  return {
    rates: computed(() => query.data.value ?? []),
    rateFrom: (from: Currency) => {
      const rates = loaded()
      return from === toValue(to) ? 1 : rates ? rateFrom(rates, from, toValue(to)) : undefined
    },
    toBase: (minor: number, from: Currency) => {
      const rates = loaded()
      return from === toValue(to) ? minor : rates ? toBaseAmount(minor, from, toValue(to), rates) : undefined
    },
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
