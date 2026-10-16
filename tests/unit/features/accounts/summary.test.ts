import { describe, expect, it } from 'bun:test'
import { accountShares, totalInBase } from '../../../../app/features/accounts/utils/summary'
import type { AccountDto, RateDto } from '../../../../app/shared/api/contract'
import type { Currency } from '../../../../app/shared/money/money'

const account = (id: string, currency: Currency, balance: number): AccountDto => ({
  id,
  name: id,
  type: 'card',
  currency,
  openingBalance: 0,
  balance,
  cardLast4: null,
  archived: false,
  inUse: false,
  linkedGoals: 0,
})

const rates: RateDto[] = [{ date: '2026-10-15', from: 'EUR', to: 'PLN', value: 4.25 }]

describe('accounts summary', () => {
  it('sums balances converted into the base currency', () => {
    expect(totalInBase([account('a', 'PLN', 10_000), account('b', 'EUR', 1_000)], rates, 'PLN')).toBe(14_250)
    expect(totalInBase([], rates, 'PLN')).toBe(0)
  })

  it('includes negative balances in the total', () => {
    expect(totalInBase([account('a', 'PLN', 10_000), account('b', 'PLN', -2_500)], rates, 'PLN')).toBe(7_500)
  })

  it('cannot total without a rate for every currency', () => {
    expect(totalInBase([account('a', 'USD', 100)], rates, 'PLN')).toBeUndefined()
  })

  it('splits positive balances into whole percents that add up to 100', () => {
    const shares = accountShares(
      [account('a', 'PLN', 1_000), account('b', 'PLN', 1_000), account('c', 'PLN', 1_000)],
      rates,
      'PLN',
    )
    expect(shares.map((share) => share.percent)).toEqual([34, 33, 33])
  })

  it('leaves out empty and overdrawn accounts and converts currencies', () => {
    const shares = accountShares(
      [account('a', 'PLN', 5_750), account('b', 'EUR', 1_000), account('c', 'PLN', 0), account('d', 'PLN', -300)],
      rates,
      'PLN',
    )
    expect(shares).toEqual([
      { id: 'a', name: 'a', percent: 58 },
      { id: 'b', name: 'b', percent: 42 },
    ])
  })

  it('returns no shares when nothing is positive', () => {
    expect(accountShares([account('a', 'PLN', -1)], rates, 'PLN')).toEqual([])
  })
})
