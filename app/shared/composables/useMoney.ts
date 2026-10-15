import { type Currency, fromMinor } from '~/shared/money/money'

export function useMoney() {
  const { n } = useI18n()

  return {
    format: (minor: number, currency: Currency, options?: { signed?: boolean }) =>
      n(fromMinor(minor), { key: 'currency', currency, signDisplay: options?.signed ? 'exceptZero' : 'auto' }),
  }
}
