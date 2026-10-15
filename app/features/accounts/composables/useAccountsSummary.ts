import { useAccounts } from '~/shared/accounts/useAccounts'
import type { AccountDto } from '~/shared/api/contract'
import { useRates } from '~/shared/rates/useRates'
import { useUserSettings } from '~/shared/user/useUserSettings'
import { accountShares, totalInBase } from '../utils/summary'

export function useAccountsSummary() {
  const accounts = useAccounts()
  const settings = useUserSettings()
  const settingsReady = computed(() => !settings.isPending.value && !settings.isError.value)
  const rates = useRates(settings.baseCurrency, { enabled: settingsReady })
  const ready = computed(
    () =>
      settingsReady.value &&
      !rates.isPending.value &&
      !rates.isError.value &&
      !accounts.isPending.value &&
      !accounts.isError.value,
  )
  const active = computed(() => accounts.accounts.value.filter((account) => !account.archived))
  const archived = computed(() => accounts.accounts.value.filter((account) => account.archived))

  return {
    active,
    archived,
    baseCurrency: settings.baseCurrency,
    total: computed(() =>
      ready.value ? totalInBase(active.value, rates.rates.value, settings.baseCurrency.value) : undefined,
    ),
    shares: computed(() =>
      ready.value ? accountShares(active.value, rates.rates.value, settings.baseCurrency.value) : [],
    ),
    baseAmountOf: (account: AccountDto) => (ready.value ? rates.toBase(account.balance, account.currency) : undefined),
    accountsPending: accounts.isPending,
    accountsError: accounts.isError,
    isPending: computed(
      () => accounts.isPending.value || settings.isPending.value || (settingsReady.value && rates.isPending.value),
    ),
    isError: computed(() => accounts.isError.value || settings.isError.value || rates.isError.value),
    refetch: () => Promise.all([accounts.refetch(), settings.refetch(), rates.refetch()]),
  }
}
