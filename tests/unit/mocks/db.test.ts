import { describe, expect, it } from 'bun:test'
import { createDb, type KeyValueStorage, STORAGE_KEY } from '../../../mocks/db'
import { seedState } from '../../../mocks/seed'

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
    expect(db.state.activeUserId).toBe('usr_anna')
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
    expect(createDb(memoryStorage(JSON.stringify({ version: 0 })), seedState).state.version).toBe(1)
  })

  it('falls back to the seed when stored state misses a key', () => {
    const stored = JSON.stringify({ ...seedState(), settings: undefined })
    expect(createDb(memoryStorage(stored), seedState).state.settings).toHaveLength(2)
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
    expect(db.state.activeUserId).toBe('usr_anna')
    expect(JSON.parse(storage.value ?? '{}').activeUserId).toBe('usr_anna')
  })
})
