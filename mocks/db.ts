import type {
  AccountDto,
  CategoryDto,
  RateDto,
  SettingsDto,
  TransactionDto,
  TransferDto,
  UserDto,
} from '../app/shared/api/contract'
import type { Currency } from '../app/shared/money/money'

export type UserRow = UserDto

export type SettingsRow = SettingsDto & { userId: string }

export type RateRow = RateDto

export type AccountRow = Omit<AccountDto, 'balance' | 'inUse'> & { userId: string; createdAt: string }

export type TransferRow = TransferDto & { userId: string }

export type CategoryRow = Omit<CategoryDto, 'inUse'> & { userId: string }

export type TransactionRow = TransactionDto & { userId: string; accountCurrency: Currency; baseCurrency: Currency }

export type BudgetRow = {
  id: string
  userId: string
  categoryId: string
  period: string
  limit: number
  currency: Currency
}

export type MockState = {
  version: 1
  activeUserId: string
  simulateErrors: boolean
  users: UserRow[]
  settings: SettingsRow[]
  rates: RateRow[]
  accounts: AccountRow[]
  transfers: TransferRow[]
  categories: CategoryRow[]
  transactions: TransactionRow[]
  budgets: BudgetRow[]
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export const STORAGE_KEY = 'mita-mock-db-v1'

export type MockDb = { state: MockState; save(): void; reset(): void }

const isState = (value: unknown, seed: MockState): value is MockState => {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Record<string, unknown>
  return (
    state.version === 1 &&
    Object.entries(seed).every(([key, seedValue]) =>
      Array.isArray(seedValue) ? Array.isArray(state[key]) : typeof state[key] === typeof seedValue,
    )
  )
}

function read(storage: KeyValueStorage | undefined, seed: () => MockState): MockState {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : undefined
    const fresh = seed()
    return isState(parsed, fresh) ? parsed : fresh
  } catch {
    return seed()
  }
}

function write(storage: KeyValueStorage | undefined, state: MockState): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

export function createDb(storage: KeyValueStorage | undefined, seed: () => MockState): MockDb {
  const db: MockDb = {
    state: read(storage, seed),
    save: () => {
      write(storage, db.state)
    },
    reset: () => {
      db.state = seed()
      write(storage, db.state)
    },
  }
  return db
}
