import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { GroupDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/currencies'
import { useUserSettings } from '~/shared/user/useUserSettings'

export function useGroupCurrencies(group: MaybeRefOrGetter<GroupDto>): ComputedRef<Currency[]> {
  const scope = useGroupScope()
  const settings = scope.value.kind === 'user' ? useUserSettings() : undefined

  return computed(() => {
    const { currency } = toValue(group)
    return settings ? [currency, settings.baseCurrency.value] : [currency]
  })
}
