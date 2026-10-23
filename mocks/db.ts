import type {
  AccountDto,
  CategoryDto,
  DebtDto,
  DebtRepaymentDto,
  GroupEntryAction,
  GroupExpenseDto,
  GroupExpenseState,
  GroupRepaymentDto,
  GroupRepaymentState,
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

export type AccountRow = Omit<AccountDto, 'balance' | 'inUse' | 'linkedGoals'> & { userId: string; createdAt: string }

export type TransferRow = TransferDto & { userId: string }

export type CategoryRow = Omit<CategoryDto, 'inUse'> & { userId: string }

export type TagRow = { id: string; userId: string; name: string }

export type TransactionRow = Omit<TransactionDto, 'tags'> & {
  userId: string
  accountCurrency: Currency
  baseCurrency: Currency
  tagIds: string[]
}

export type BudgetRow = {
  id: string
  userId: string
  categoryId: string
  period: string
  limit: number
  currency: Currency
}

export type GoalRow = {
  id: string
  userId: string
  name: string
  target: number
  saved: number
  currency: Currency
  deadline: string | null
  accountId: string | null
  createdAt: string
}

export type GoalContributionRow = {
  id: string
  userId: string
  goalId: string
  date: string
  amount: number
  currency: Currency
  fromAccountId: string | null
  transferId: string | null
  baseAmount: number
  baseCurrency: Currency
}

export type DebtRow = Omit<DebtDto, 'remaining' | 'status' | 'overdue' | 'repayments'> & {
  userId: string
  createdAt: string
}

export type DebtRepaymentRow = DebtRepaymentDto & { userId: string; debtId: string; createdAt: string }

export type GroupRow = {
  id: string
  userId: string
  name: string
  currency: Currency
  createdAt: string
  shareToken: string | null
}

export type GroupMemberRow = { id: string; groupId: string; name: string; position: number }

export type GroupCategoryRow = { id: string; groupId: string; name: string; createdAt: string }

type EntryAudit = 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'

export type GroupExpenseRow = Omit<GroupExpenseDto, EntryAudit> & { groupId: string; createdAt: string }

export type GroupRepaymentRow = Omit<GroupRepaymentDto, EntryAudit> & { groupId: string; createdAt: string }

export type GroupEventRow = {
  id: string
  groupId: string
  kind: 'expense' | 'repayment'
  entryId: string
  action: GroupEntryAction
  at: string
  actorUserId: string | null
  actorMemberId: string | null
  state: GroupExpenseState | GroupRepaymentState
}

export type CredentialRow = { userId: string; password: string }

export type MockState = {
  version: 5
  activeUserId: string | null
  simulateErrors: boolean
  users: UserRow[]
  credentials: CredentialRow[]
  settings: SettingsRow[]
  rates: RateRow[]
  accounts: AccountRow[]
  transfers: TransferRow[]
  categories: CategoryRow[]
  tags: TagRow[]
  transactions: TransactionRow[]
  budgets: BudgetRow[]
  goals: GoalRow[]
  goalContributions: GoalContributionRow[]
  debts: DebtRow[]
  debtRepayments: DebtRepaymentRow[]
  groups: GroupRow[]
  groupMembers: GroupMemberRow[]
  groupCategories: GroupCategoryRow[]
  groupExpenses: GroupExpenseRow[]
  groupRepayments: GroupRepaymentRow[]
  groupEvents: GroupEventRow[]
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export const STORAGE_KEY = 'mita-mock-db-v1'

export type MockDb = { state: MockState; save(): void; reset(): void; reload(): void }

const isState = (value: unknown, seed: MockState): value is MockState => {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Record<string, unknown>
  return (
    state.version === 5 &&
    Object.entries(seed).every(([key, seedValue]) => {
      if (key === 'activeUserId') return state[key] === null || typeof state[key] === 'string'
      return Array.isArray(seedValue) ? Array.isArray(state[key]) : typeof state[key] === typeof seedValue
    })
  )
}

const latestDate = (rows: readonly RateRow[]): string =>
  rows.reduce((latest, row) => (row.date > latest ? row.date : latest), '')

// A rate older than 30 days counts as missing, so a stored state needs the days seeded since it was saved.
function withCurrentRates(stored: MockState, fresh: MockState): MockState {
  const latest = latestDate(stored.rates)
  return { ...stored, rates: [...stored.rates, ...fresh.rates.filter((row) => row.date > latest)] }
}

function read(storage: KeyValueStorage | undefined, seed: () => MockState): MockState {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : undefined
    const fresh = seed()
    return isState(parsed, fresh) ? withCurrentRates(parsed, fresh) : fresh
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
    reload: () => {
      db.state = read(storage, seed)
    },
  }
  return db
}
