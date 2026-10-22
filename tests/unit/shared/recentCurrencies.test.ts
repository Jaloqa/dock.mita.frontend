import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  RECENT_CURRENCIES_MAX,
  readRecentCurrencies,
  rememberCurrency,
} from '../../../app/shared/money/recentCurrencies'

const STORAGE_KEY = 'mita.recentCurrencies'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

class FullStorage extends MemoryStorage {
  override setItem() {
    throw new Error('QuotaExceededError')
  }
}

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

const installStorage = (get: () => Storage) =>
  Object.defineProperty(globalThis, 'localStorage', { get, configurable: true })

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  installStorage(() => storage)
})

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original)
  else Reflect.deleteProperty(globalThis, 'localStorage')
})

describe('recent currencies', () => {
  it('keeps the most recent pick first and every currency once', () => {
    rememberCurrency('JPY')
    rememberCurrency('KWD')
    rememberCurrency('JPY')
    expect(readRecentCurrencies()).toEqual(['JPY', 'KWD'])
    expect(storage.getItem(STORAGE_KEY)).toBe('["JPY","KWD"]')
  })

  it('keeps at most five', () => {
    for (const currency of ['JPY', 'KWD', 'GBP', 'CHF', 'NOK', 'SEK'] as const) rememberCurrency(currency)
    expect(RECENT_CURRENCIES_MAX).toBe(5)
    expect(readRecentCurrencies()).toEqual(['SEK', 'NOK', 'CHF', 'GBP', 'KWD'])
  })

  it('drops invalid stored values', () => {
    storage.setItem(STORAGE_KEY, '["XDR","JPY"]')
    expect(readRecentCurrencies()).toEqual(['JPY'])
    storage.setItem(STORAGE_KEY, '[1,null,"kwd","KWD","KWD"]')
    expect(readRecentCurrencies()).toEqual(['KWD'])
    storage.setItem(STORAGE_KEY, '"JPY"')
    expect(readRecentCurrencies()).toEqual([])
    storage.setItem(STORAGE_KEY, 'not json')
    expect(readRecentCurrencies()).toEqual([])
    storage.setItem(STORAGE_KEY, '["JPY","KWD","GBP","CHF","NOK","SEK"]')
    expect(readRecentCurrencies()).toEqual(['JPY', 'KWD', 'GBP', 'CHF', 'NOK'])
  })

  it('reads nothing and remembers without throwing when the storage is blocked', () => {
    installStorage(() => {
      throw new Error('SecurityError')
    })
    expect(readRecentCurrencies()).toEqual([])
    expect(() => rememberCurrency('JPY')).not.toThrow()
  })

  it('remembers without throwing when the storage is full', () => {
    const full = new FullStorage()
    installStorage(() => full)
    expect(() => rememberCurrency('JPY')).not.toThrow()
    expect(readRecentCurrencies()).toEqual([])
  })

  it('reads nothing when there is no storage at all', () => {
    Reflect.deleteProperty(globalThis, 'localStorage')
    expect(readRecentCurrencies()).toEqual([])
    expect(() => rememberCurrency('JPY')).not.toThrow()
  })
})
