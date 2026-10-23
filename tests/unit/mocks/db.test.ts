import { describe, expect, it } from 'bun:test'
import type { RateDto } from '../../../app/shared/api/contract'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import { createMockApi } from '../../../mocks/api'
import { createDb, type KeyValueStorage, type RateRow, STORAGE_KEY } from '../../../mocks/db'
import { defaultHandlers } from '../../../mocks/handlers'
import { freshRateOn } from '../../../mocks/rates'
import { seedState } from '../../../mocks/seed'
import { seedRates } from '../../../mocks/seed/rates'

const memoryStorage = (initial?: string): KeyValueStorage & { value: string | null } => {
  const store = {
    value: initial ?? null,
    getItem: (key: string) => (key === STORAGE_KEY ? store.value : null),
    setItem: (_key: string, value: string) => {
      store.value = value
    },
  }
  return store
}

describe('mock db', () => {
  it('starts from the seed when storage is empty', () => {
    const db = createDb(memoryStorage(), seedState)
    expect(db.state.activeUserId).toBeNull()
    expect(db.state.users.map((user) => user.id)).toEqual(['usr_anna', 'usr_oleh'])
    expect(db.state.settings).toHaveLength(2)
  })

  it('gives the two demo users different settings', () => {
    const [anna, oleh] = seedState().settings
    expect(anna).toMatchObject({ userId: 'usr_anna', baseCurrency: 'PLN', locale: 'pl', monthStartDay: 1 })
    expect(oleh).toMatchObject({ userId: 'usr_oleh', baseCurrency: 'UAH', locale: 'uk', monthStartDay: 10 })
  })

  it('persists changes and reads them back', () => {
    const storage = memoryStorage()
    const db = createDb(storage, seedState)
    db.state.simulateErrors = true
    db.save()
    expect(createDb(storage, seedState).state.simulateErrors).toBe(true)
  })

  it('reloads changes another tab wrote to storage', () => {
    const storage = memoryStorage()
    const db = createDb(storage, seedState)
    db.save()
    const otherTab = createDb(storage, seedState)
    otherTab.state.simulateErrors = true
    otherTab.save()
    expect(db.state.simulateErrors).toBe(false)
    db.reload()
    expect(db.state.simulateErrors).toBe(true)
  })

  it('falls back to the seed when stored JSON is corrupted', () => {
    expect(createDb(memoryStorage('{not json'), seedState).state.users).toHaveLength(2)
  })

  it('falls back to the seed when stored data has another version', () => {
    expect(createDb(memoryStorage(JSON.stringify({ version: 0 })), seedState).state.version).toBe(3)
  })

  it('reseeds a stored state of version 1 so every currency gets rates', () => {
    const stored = JSON.stringify({ ...seedState(), version: 1, rates: [], simulateErrors: true })
    const { state } = createDb(memoryStorage(stored), seedState)
    expect(state.version).toBe(3)
    expect(state.simulateErrors).toBe(false)
    expect(state.rates.some((row) => row.from === 'KWD')).toBe(true)
  })

  it('reseeds a stored state of version 2 so the demo users get debts', () => {
    const { debts: _debts, debtRepayments: _repayments, ...before } = seedState()
    const stored = JSON.stringify({ ...before, version: 2, simulateErrors: true })
    const { state } = createDb(memoryStorage(stored), seedState)
    expect(state.version).toBe(3)
    expect(state.simulateErrors).toBe(false)
    expect(state.debts.map((row) => row.counterparty)).toEqual(['Max', 'Mama', 'Kasia', 'Tomek', 'Андрій'])
    expect(state.debtRepayments).toHaveLength(3)
  })

  it('reseeds a stored state of version 2 even when it carries every key', () => {
    const stored = JSON.stringify({ ...seedState(), version: 2, simulateErrors: true })
    expect(createDb(memoryStorage(stored), seedState).state.simulateErrors).toBe(false)
  })

  it('falls back to the seed when a stored state of version 3 has no debts', () => {
    const { debts: _debts, ...older } = seedState()
    const stored = JSON.stringify({ ...older, simulateErrors: true })
    const { state } = createDb(memoryStorage(stored), seedState)
    expect(state.simulateErrors).toBe(false)
    expect(state.debts).toHaveLength(5)
  })

  it('keeps a stored state of the current version', () => {
    const stored = JSON.stringify({ ...seedState(), simulateErrors: true })
    expect(createDb(memoryStorage(stored), seedState).state.simulateErrors).toBe(true)
  })

  describe('stored rates', () => {
    const today = todayIso()
    const seededLongAgo = () => ({ ...seedState(addDaysIso(today, -40)), activeUserId: 'usr_oleh' })
    const latest = (rows: RateRow[]) => rows.reduce((date, row) => (row.date > date ? row.date : date), '')

    it('tops up the rates of a state seeded more than 30 days ago and keeps the rest', () => {
      const old = { ...seededLongAgo(), simulateErrors: true }
      const { state } = createDb(memoryStorage(JSON.stringify(old)), seedState)
      expect(state.activeUserId).toBe('usr_oleh')
      expect(state.simulateErrors).toBe(true)
      expect(state.accounts).toEqual(old.accounts)
      expect(state.transactions).toEqual(old.transactions)
      expect(state.rates.slice(0, old.rates.length)).toEqual(old.rates)
      expect(state.rates.slice(old.rates.length)).toEqual(
        seedRates(today).filter((row) => row.date > latest(old.rates)),
      )
      expect(latest(state.rates)).toBe(today)
      expect(freshRateOn(state.rates, today, today, 'EUR', 'PLN')).toBeDefined()
      expect(freshRateOn(state.rates, today, today, 'KWD', 'PLN')).toBeDefined()
    })

    it('answers every pair of GET /v1/rates after the stored rates went stale', async () => {
      const storage = memoryStorage(JSON.stringify(seededLongAgo()))
      const rates = (await createMockApi({ storage, register: defaultHandlers }).handle({
        method: 'GET',
        path: '/v1/rates',
        query: { to: 'PLN' },
      })) as RateDto[]
      expect(rates).toHaveLength(147)
    })

    it('persists the topped-up rates once and adds nothing on a later load', () => {
      const storage = memoryStorage(JSON.stringify(seededLongAgo()))
      const db = createDb(storage, seedState)
      db.save()
      expect(latest(JSON.parse(storage.value ?? '{}').rates)).toBe(today)
      const reloaded = createDb(storage, seedState).state.rates
      expect(reloaded).toEqual(db.state.rates)
      const keys = reloaded.map((row) => `${row.from}|${row.date}`)
      expect(new Set(keys).size).toBe(keys.length)
    })
  })

  it('falls back to the seed when stored state misses a key', () => {
    const stored = JSON.stringify({ ...seedState(), settings: undefined })
    expect(createDb(memoryStorage(stored), seedState).state.settings).toHaveLength(2)
  })

  it('falls back to the seed when stored state has no tags', () => {
    const { tags: _tags, ...older } = seedState()
    expect(createDb(memoryStorage(JSON.stringify(older)), seedState).state.tags).toHaveLength(4)
  })

  it('falls back to the seed when a stored key has the wrong kind', () => {
    const stored = JSON.stringify({ ...seedState(), users: 'x' })
    expect(createDb(memoryStorage(stored), seedState).state.users).toHaveLength(2)
  })

  it('falls back to the seed when a stored boolean flag is missing', () => {
    const stored = JSON.stringify({ ...seedState(), simulateErrors: undefined })
    expect(createDb(memoryStorage(stored), seedState).state.simulateErrors).toBe(false)
  })

  it('accepts stored state with extra unknown keys', () => {
    const stored = JSON.stringify({ ...seedState(), activeUserId: 'usr_oleh', extra: 1 })
    expect(createDb(memoryStorage(stored), seedState).state.activeUserId).toBe('usr_oleh')
  })

  it('works in memory without storage', () => {
    const db = createDb(undefined, seedState)
    db.state.simulateErrors = true
    expect(() => db.save()).not.toThrow()
  })

  it('survives a storage that throws on write', () => {
    const storage: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(() => createDb(storage, seedState).save()).not.toThrow()
  })

  it('resets to the seed', () => {
    const storage = memoryStorage()
    const db = createDb(storage, seedState)
    db.state.activeUserId = 'usr_oleh'
    db.reset()
    expect(db.state.activeUserId).toBeNull()
    expect(JSON.parse(storage.value ?? '{}').activeUserId).toBeNull()
  })
})
