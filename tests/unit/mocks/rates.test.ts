import { describe, expect, it } from 'bun:test'
import type { RateDto } from '../../../app/shared/api/contract'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import { createDb, type RateRow } from '../../../mocks/db'
import { rateOn } from '../../../mocks/rates'
import { seedState } from '../../../mocks/seed'
import { RATE_HISTORY_DAYS, seedRates } from '../../../mocks/seed/rates'
import { loggedInMockApi } from './session'

const api = () => loggedInMockApi()
const today = todayIso()

describe('rate table', () => {
  it('covers about six months for every quoted currency', () => {
    const rows = seedRates('2026-10-15')
    const eur = rows.filter((row) => row.from === 'EUR')
    expect(rows).toHaveLength(3 * (RATE_HISTORY_DAYS + 1))
    expect(eur[0]?.date).toBe(addDaysIso('2026-10-15', -RATE_HISTORY_DAYS))
    expect(eur.at(-1)?.date).toBe('2026-10-15')
    expect(rows.every((row) => row.to === 'PLN')).toBe(true)
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

  it('gives a date the same value whatever day the table was seeded on', () => {
    const find = (rows: RateRow[]) => rows.find((row) => row.from === 'USD' && row.date === '2026-08-01')?.value
    expect(find(seedRates('2026-10-15'))).toBe(find(seedRates('2026-09-01')))
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

  it('replaces stored data from before the accounts tables existed', () => {
    const { rates: _rates, accounts: _accounts, transfers: _transfers, ...old } = seedState()
    const storage = { getItem: () => JSON.stringify(old), setItem: () => {} }
    expect(createDb(storage, seedState).state.rates.length).toBeGreaterThan(0)
  })
})

describe('GET /v1/rates', () => {
  it('returns today rates into the requested currency by default', async () => {
    const rates = (await api().handle({ method: 'GET', path: '/v1/rates', query: { to: 'PLN' } })) as RateDto[]
    expect(rates.map((rate) => rate.from).sort()).toEqual(['EUR', 'UAH', 'USD'])
    expect(rates.every((rate) => rate.to === 'PLN' && rate.date === today)).toBe(true)
  })

  it('returns one pair for a given date', async () => {
    const mock = api()
    const date = addDaysIso(today, -30)
    const rates = await mock.handle({ method: 'GET', path: '/v1/rates', query: { from: 'EUR', to: 'UAH', date } })
    expect(rates).toEqual([{ date, from: 'EUR', to: 'UAH', value: rateOn(mock.db.state.rates, date, 'EUR', 'UAH') }])
  })

  it('lists every pair when no currency is given', async () => {
    expect(await api().handle({ method: 'GET', path: '/v1/rates' })).toHaveLength(12)
  })

  it('rejects an invalid date or currency', async () => {
    const error = await api()
      .handle({ method: 'GET', path: '/v1/rates', query: { date: '2026-13-01', from: 'XDR' } })
      .catch((e: unknown) => e)
    expect(error).toMatchObject({
      problem: { status: 400, errors: { date: ['validation.invalidValue'], from: ['validation.invalidValue'] } },
    })
  })
})
