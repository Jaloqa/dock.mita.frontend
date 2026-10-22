import { describe, expect, it } from 'bun:test'
import { CURRENCIES, type Currency } from '../../../app/shared/money/currencies'
import {
  currencyGroups,
  currencyName,
  currencyOption,
  PINNED_CURRENCIES_MAX,
  pinnedCurrencies,
} from '../../../app/shared/money/currencyOptions'

const labels = { pinned: 'Your currencies', all: 'All currencies' }

describe('currency names', () => {
  it('names a currency in the language of the locale', () => {
    expect(currencyName('JPY', 'en')).toBe('Japanese Yen')
    expect(currencyName('JPY', 'pl')).toContain('jen')
    expect(currencyName('UAH', 'uk')).toContain('гривня')
  })

  it('falls back to the code when there is no name', () => {
    expect(currencyName('ZZZ' as Currency, 'en')).toBe('ZZZ')
    expect(currencyName('JPY', 'not a locale')).toBe('JPY')
  })

  it('labels an option with the code and the name', () => {
    expect(currencyOption('JPY', 'en')).toEqual({
      value: 'JPY',
      code: 'JPY',
      name: 'Japanese Yen',
      label: 'JPY — Japanese Yen',
    })
    expect(currencyOption('ZZZ' as Currency, 'en').label).toBe('ZZZ')
  })
})

describe('pinned currencies', () => {
  it('puts the recent picks first and keeps every code once', () => {
    expect(pinnedCurrencies(['KWD'], ['PLN', 'EUR', 'KWD'], CURRENCIES)).toEqual(['KWD', 'PLN', 'EUR'])
    expect(pinnedCurrencies([], ['PLN', 'PLN', 'EUR', 'PLN'], CURRENCIES)).toEqual(['PLN', 'EUR'])
  })

  it('keeps at most eight', () => {
    const pinned = pinnedCurrencies(['JPY', 'KWD', 'GBP', 'CHF', 'NOK'], ['PLN', 'EUR', 'USD', 'UAH'], CURRENCIES)
    expect(PINNED_CURRENCIES_MAX).toBe(8)
    expect(pinned).toEqual(['JPY', 'KWD', 'GBP', 'CHF', 'NOK', 'PLN', 'EUR', 'USD'])
  })

  it('drops the codes that are not offered', () => {
    expect(pinnedCurrencies(['JPY'], ['PLN', 'KWD', 'EUR'], ['PLN', 'EUR', 'USD', 'UAH'])).toEqual(['PLN', 'EUR'])
  })
})

describe('currency groups', () => {
  it('lists the pinned currencies above all the others by code', () => {
    const groups = currencyGroups('en', CURRENCIES, ['PLN', 'EUR'], labels)
    expect(groups.map((group) => group.label)).toEqual(['Your currencies', 'All currencies'])
    expect(groups[0]?.items.map((item) => item.label)).toEqual(['PLN — Polish Zloty', 'EUR — Euro'])
    const rest = groups[1]?.items.map((item) => item.code) ?? []
    expect(rest).toHaveLength(146)
    expect(rest[0]).toBe('AED')
    expect(rest).toEqual([...rest].sort())
    expect(rest).not.toContain('PLN')
    expect(rest).not.toContain('EUR')
    expect(rest).toContain('USD')
  })

  it('has no pinned group when nothing is pinned', () => {
    const groups = currencyGroups('en', CURRENCIES, [], labels)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('All currencies')
    expect(groups[0]?.items).toHaveLength(148)
  })

  it('names the options in the language of the locale', () => {
    const [pinned] = currencyGroups('pl', CURRENCIES, ['JPY'], labels)
    expect(pinned?.items[0]?.name).toContain('jen')
    expect(pinned?.items[0]?.label.startsWith('JPY — ')).toBe(true)
  })
})
