import type { AccountDto, RateDto } from '../../../shared/api/contract'
import type { Currency } from '../../../shared/money/money'
import { toBaseAmount } from '../../../shared/rates/convert'

export type AccountShare = { id: string; name: string; percent: number }

export function totalInBase(
  accounts: readonly AccountDto[],
  rates: readonly RateDto[],
  base: Currency,
): number | undefined {
  let total = 0
  for (const account of accounts) {
    const amount = toBaseAmount(account.balance, account.currency, base, rates)
    if (amount === undefined) return undefined
    total += amount
  }
  return total
}

export function accountShares(
  accounts: readonly AccountDto[],
  rates: readonly RateDto[],
  base: Currency,
): AccountShare[] {
  const values = accounts
    .map((account) => ({
      id: account.id,
      name: account.name,
      value: toBaseAmount(account.balance, account.currency, base, rates) ?? 0,
    }))
    .filter((entry) => entry.value > 0)
  const sum = values.reduce((total, entry) => total + entry.value, 0)
  if (sum === 0) return []
  const exact = values.map((entry) => (entry.value * 100) / sum)
  const percents = exact.map((value) => Math.floor(value))
  let missing = 100 - percents.reduce((total, value) => total + value, 0)
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder)
  for (const { index } of byRemainder) {
    if (missing <= 0) break
    percents[index] = (percents[index] ?? 0) + 1
    missing -= 1
  }
  return values.map((entry, index) => ({ id: entry.id, name: entry.name, percent: percents[index] ?? 0 }))
}
