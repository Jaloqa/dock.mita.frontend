import { describe, expect, it } from 'bun:test'
import type { RateDto } from '../../../app/shared/api/contract'
import { CURRENCIES } from '../../../app/shared/money/currencies'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import { createDb, type RateRow } from '../../../mocks/db'
import { freshRateOn, rateOn } from '../../../mocks/rates'
import { seedState } from '../../../mocks/seed'
import { RATE_LEVELS } from '../../../mocks/seed/rateLevels'
import { RATE_HISTORY_DAYS, seedRates } from '../../../mocks/seed/rates'
import { loggedInMockApi, quoteRate } from './session'

const api = () => loggedInMockApi()
const today = todayIso()
const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)

const weekday = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay()
const WEDNESDAY = 3
const MONDAY = 1

const lastWeekday = (day: number, from: string): string => {
  let date = from
  while (weekday(date) !== day) date = addDaysIso(date, -1)
  return date
}

const daily = ['EUR', 'USD', 'UAH']
const quoted = CURRENCIES.filter((currency) => currency !== 'PLN')

describe('rate levels', () => {
  it('holds the NBP mid of 2026-10-21/22 for every quoted currency', () => {
    expect(Object.keys(RATE_LEVELS).sort()).toEqual([...quoted].sort())
    expect(Object.values(RATE_LEVELS).every((level) => level > 0)).toBe(true)
    expect(RATE_LEVELS).toMatchObject({ JPY: 0.024764, KWD: 12.6221, IRR: 0.00000212, VND: 0.0001503 })
  })
})

describe('rate table', () => {
  it('covers about six months of every quoted currency', () => {
    const rows = seedRates('2026-10-15')
    const eur = rows.filter((row) => row.from === 'EUR')
    expect(eur).toHaveLength(RATE_HISTORY_DAYS + 1)
    expect(eur[0]?.date).toBe(addDaysIso('2026-10-15', -RATE_HISTORY_DAYS))
    expect(eur.at(-1)?.date).toBe('2026-10-15')
    expect(rows.every((row) => row.to === 'PLN')).toBe(true)
    expect(new Set(rows.map((row) => row.from))).toEqual(new Set(quoted))
  })

  it('quotes EUR, USD and UAH every day and every other currency on Wednesdays only', () => {
    const rows = seedRates('2026-10-22')
    for (const currency of quoted) {
      const dates = rows.filter((row) => row.from === currency).map((row) => row.date)
      if (daily.includes(currency)) expect(dates).toHaveLength(RATE_HISTORY_DAYS + 1)
      else {
        expect(dates.length).toBeGreaterThanOrEqual(26)
        expect(dates.length).toBeLessThanOrEqual(27)
        expect(dates.every((date) => weekday(date) === WEDNESDAY)).toBe(true)
        expect(dates.at(-1)).toBe('2026-10-21')
      }
    }
  })

  it('has one row per currency and date', () => {
    const keys = seedRates('2026-10-22').map((row) => `${row.from}|${row.date}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('drifts gently from day to day around a realistic level', () => {
    const eur = seedRates('2026-10-15')
      .filter((row) => row.from === 'EUR')
      .map((row) => row.value)
    for (const [index, value] of eur.entries()) {
      const previous = eur[index - 1]
      if (previous !== undefined) expect(Math.abs(value / previous - 1)).toBeLessThan(0.005)
    }
    expect(Math.min(...eur)).toBeGreaterThan(4)
    expect(Math.max(...eur)).toBeLessThan(4.5)
  })

  it('keeps every weekly currency within a few percent of its level and never rounds it to zero', () => {
    for (const row of seedRates('2026-10-22')) {
      expect(row.value).toBeGreaterThan(0)
      if (daily.includes(row.from)) continue
      const level = RATE_LEVELS[row.from as keyof typeof RATE_LEVELS]
      expect(Math.abs(row.value / level - 1)).toBeLessThan(0.03)
    }
  })

  it('gives a date the same value whatever day the table was seeded on', () => {
    const find = (rows: RateRow[], from: string, date: string) =>
      rows.find((row) => row.from === from && row.date === date)?.value
    const wednesday = lastWeekday(WEDNESDAY, '2026-08-05')
    expect(find(seedRates('2026-10-15'), 'USD', '2026-08-01')).toBe(find(seedRates('2026-09-01'), 'USD', '2026-08-01'))
    expect(find(seedRates('2026-10-15'), 'KWD', wednesday)).toBe(find(seedRates('2026-09-01'), 'KWD', wednesday))
  })

  it('derives cross rates through PLN and falls back to the nearest earlier day', () => {
    const rows: RateRow[] = [
      { date: '2026-10-01', from: 'EUR', to: 'PLN', value: 4.3 },
      { date: '2026-10-01', from: 'USD', to: 'PLN', value: 4 },
      { date: '2026-10-03', from: 'EUR', to: 'PLN', value: 4.4 },
    ]
    expect(rateOn(rows, '2026-10-02', 'EUR', 'PLN')).toBe(4.3)
    expect(rateOn(rows, '2026-10-05', 'EUR', 'PLN')).toBe(4.4)
    expect(rateOn(rows, '2026-09-01', 'EUR', 'PLN')).toBe(4.3)
    expect(rateOn(rows, '2026-10-01', 'PLN', 'EUR')).toBe(0.232558)
    expect(rateOn(rows, '2026-10-01', 'EUR', 'USD')).toBe(1.075)
    expect(rateOn(rows, '2026-10-01', 'UAH', 'UAH')).toBe(1)
  })

  it('crosses a tiny rate without collapsing it', () => {
    const rows: RateRow[] = [
      { date: '2026-10-01', from: 'IRR', to: 'PLN', value: 0.00000212 },
      { date: '2026-10-01', from: 'KWD', to: 'PLN', value: 12.6221 },
      { date: '2026-10-01', from: 'VND', to: 'PLN', value: 0.0001503 },
    ]
    expect(rateOn(rows, '2026-10-01', 'IRR', 'KWD')).toBe(0.000000167959)
    expect(rateOn(rows, '2026-10-01', 'VND', 'PLN')).toBe(0.0001503)
  })

  it('answers 503 when a currency has no rate at all', async () => {
    expect(await failure(Promise.resolve().then(() => rateOn([], today, 'EUR', 'PLN')))).toMatchObject({
      problem: { status: 503, code: 'rates.unavailable' },
    })
  })

  it('replaces stored data from before the accounts tables existed', () => {
    const { rates: _rates, accounts: _accounts, transfers: _transfers, ...old } = seedState()
    const storage = { getItem: () => JSON.stringify(old), setItem: () => {} }
    expect(createDb(storage, seedState).state.rates.length).toBeGreaterThan(0)
  })
})

describe('fresh rate lookup', () => {
  const kwd = (date: string): RateRow => ({ date, from: 'KWD', to: 'PLN', value: 12.6 })

  it('accepts a rate exactly 30 days old and refuses one 31 days old', () => {
    const rows = [kwd('2026-09-01')]
    expect(freshRateOn(rows, '2026-10-01', '2026-10-01', 'KWD', 'PLN')).toBe(12.6)
    expect(freshRateOn(rows, '2026-10-02', '2026-10-02', 'KWD', 'PLN')).toBeUndefined()
  })

  it('measures the age against the earlier of the date and today', () => {
    const rows = [kwd('2026-09-01')]
    expect(freshRateOn(rows, '2026-10-15', '2026-10-01', 'KWD', 'PLN')).toBe(12.6)
    expect(freshRateOn(rows, '2026-10-01', '2026-10-15', 'KWD', 'PLN')).toBe(12.6)
    expect(freshRateOn(rows, '2026-10-02', '2026-10-15', 'KWD', 'PLN')).toBeUndefined()
  })

  it('never calls the earliest rate stale when the date is before the history', () => {
    const rows = [kwd('2026-09-01')]
    expect(freshRateOn(rows, '2026-01-01', '2026-10-22', 'KWD', 'PLN')).toBe(12.6)
  })

  it('needs both currencies fresh and returns 1 for the same currency', () => {
    const rows: RateRow[] = [kwd('2026-09-01'), { date: '2026-10-01', from: 'EUR', to: 'PLN', value: 4.3 }]
    expect(freshRateOn(rows, '2026-10-02', '2026-10-02', 'EUR', 'KWD')).toBeUndefined()
    expect(freshRateOn(rows, '2026-10-01', '2026-10-01', 'EUR', 'KWD')).toBe(0.34127)
    expect(freshRateOn(rows, '2026-10-02', '2026-10-02', 'EUR', 'PLN')).toBe(4.3)
    expect(freshRateOn(rows, '2026-10-02', '2026-10-02', 'KWD', 'KWD')).toBe(1)
    expect(freshRateOn([], '2026-10-02', '2026-10-02', 'EUR', 'PLN')).toBeUndefined()
  })

  it('leaves the unfiltered lookup alone for stored data', () => {
    expect(rateOn([kwd('2026-01-01')], '2026-10-22', 'KWD', 'PLN')).toBe(12.6)
  })
})

describe('GET /v1/rates', () => {
  it('returns today rates of every other currency into the requested one', async () => {
    const rates = (await api().handle({ method: 'GET', path: '/v1/rates', query: { to: 'PLN' } })) as RateDto[]
    expect(rates).toHaveLength(147)
    expect(rates.map((rate) => rate.from).sort()).toEqual([...quoted].sort())
    expect(rates.every((rate) => rate.to === 'PLN' && rate.date === today)).toBe(true)
  })

  it('returns the requested currency against every other one', async () => {
    const rates = (await api().handle({ method: 'GET', path: '/v1/rates', query: { from: 'KWD' } })) as RateDto[]
    expect(rates).toHaveLength(147)
    expect(rates.every((rate) => rate.from === 'KWD' && rate.to !== 'KWD')).toBe(true)
  })

  it('returns one pair for a given date', async () => {
    const mock = api()
    const date = addDaysIso(today, -30)
    const rates = await mock.handle({ method: 'GET', path: '/v1/rates', query: { from: 'EUR', to: 'UAH', date } })
    expect(rates).toEqual([{ date, from: 'EUR', to: 'UAH', value: rateOn(mock.db.state.rates, date, 'EUR', 'UAH') }])
  })

  it('never returns a pair of one currency', async () => {
    expect(await api().handle({ method: 'GET', path: '/v1/rates', query: { from: 'JPY', to: 'JPY' } })).toEqual([])
  })

  it('reads a weekly currency at the latest Wednesday before the date', async () => {
    const mock = api()
    const monday = lastWeekday(MONDAY, addDaysIso(today, -7))
    const wednesday = addDaysIso(monday, -5)
    const stored = mock.db.state.rates.find((row) => row.from === 'KWD' && row.date === wednesday)
    expect(stored).toBeDefined()
    const rates = await mock.handle({
      method: 'GET',
      path: '/v1/rates',
      query: { from: 'KWD', to: 'PLN', date: monday },
    })
    expect(rates).toEqual([{ date: monday, from: 'KWD', to: 'PLN', value: stored?.value }])
  })

  it('omits a pair whose rate is older than 30 days', async () => {
    const mock = api()
    quoteRate(mock, 'KWD', 12.6221, addDaysIso(today, -31))
    const rates = (await mock.handle({ method: 'GET', path: '/v1/rates', query: { to: 'PLN' } })) as RateDto[]
    expect(rates).toHaveLength(146)
    expect(rates.some((rate) => rate.from === 'KWD')).toBe(false)
    mock.db.state.rates.push({ date: addDaysIso(today, -30), from: 'KWD', to: 'PLN', value: 12.6221 })
    expect(await mock.handle({ method: 'GET', path: '/v1/rates', query: { from: 'KWD', to: 'PLN' } })).toHaveLength(1)
  })

  it('requires from or to', async () => {
    expect(await failure(api().handle({ method: 'GET', path: '/v1/rates' }))).toMatchObject({
      problem: { status: 400, errors: { to: ['validation.required'] } },
    })
    expect(await failure(api().handle({ method: 'GET', path: '/v1/rates', query: { date: today } }))).toMatchObject({
      problem: { status: 400, errors: { to: ['validation.required'] } },
    })
  })

  it('rejects an invalid date or currency', async () => {
    const error = await failure(
      api().handle({ method: 'GET', path: '/v1/rates', query: { date: '2026-13-01', from: 'XDR' } }),
    )
    expect(error).toMatchObject({
      problem: { status: 400, errors: { date: ['validation.invalidValue'], from: ['validation.invalidValue'] } },
    })
  })
})
