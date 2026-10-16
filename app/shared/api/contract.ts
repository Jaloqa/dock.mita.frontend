import type { Currency } from '../money/money'
import type { MonthStart } from '../period/period'

export type Locale = 'en' | 'pl' | 'ru' | 'uk'

export const locales: readonly Locale[] = ['en', 'pl', 'ru', 'uk']

export type ThemePreference = 'system' | 'light' | 'dark'

export const themePreferences: readonly ThemePreference[] = ['system', 'light', 'dark']

export type NotificationPrefs = {
  budgetLimit: boolean
  dailyReminder: boolean
  weeklyReport: boolean
  goals: boolean
}

export type UserDto = { id: string; name: string; email: string; createdAt: string }

export type SettingsDto = {
  baseCurrency: Currency
  locale: Locale
  monthStartDay: MonthStart
  theme: ThemePreference
  notifications: NotificationPrefs
}

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number }

export type DemoStateDto = {
  activeUserId: string
  users: { id: string; name: string }[]
  simulateErrors: boolean
}

export type AccountType = 'card' | 'cash' | 'savings'

export const accountTypes: readonly AccountType[] = ['card', 'cash', 'savings']

export type AccountDto = {
  id: string
  name: string
  type: AccountType
  currency: Currency
  openingBalance: number
  balance: number
  cardLast4: string | null
  archived: boolean
  inUse: boolean
  linkedGoals: number
}

export type AccountInput = {
  name: string
  type: AccountType
  currency: Currency
  openingBalance: number
  cardLast4?: string | null
  archived?: boolean
}

export type TransferDto = {
  id: string
  date: string
  fromAccountId: string
  toAccountId: string
  fromAmount: number
  toAmount: number
  rate: number
  note: string | null
}

export type TransferInput = {
  date: string
  fromAccountId: string
  toAccountId: string
  fromAmount: number
  rate?: number
  note?: string
}

export type RateDto = { date: string; from: Currency; to: Currency; value: number }

export type CategoryKind = 'expense' | 'income'

export const categoryKinds: readonly CategoryKind[] = ['expense', 'income']

export type CategoryColor = 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5' | 'chart-6'

export const categoryColors: readonly CategoryColor[] = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
]

export type SystemCategory = 'transfer' | 'other'

export type CategoryDto = {
  id: string
  name: string
  kind: CategoryKind
  color: CategoryColor
  system: SystemCategory | null
  inUse: boolean
}

export type CategoryInput = { name: string; kind: CategoryKind; color: CategoryColor }

export type TransactionSort = '-date' | 'date' | '-amount' | 'amount'

export const transactionSorts: readonly TransactionSort[] = ['-date', 'date', '-amount', 'amount']

export type TransactionDto = {
  id: string
  kind: CategoryKind
  date: string
  title: string
  note: string | null
  categoryId: string
  accountId: string
  amount: number
  currency: Currency
  accountAmount: number
  rate: number
  baseAmount: number
}

export type TransactionInput = {
  kind: CategoryKind
  date: string
  title?: string
  note?: string
  categoryId: string
  accountId: string
  amount: number
  currency: Currency
  rate?: number
}

export type TransactionQuery = {
  search?: string
  categoryId?: string
  accountId?: string
  kind?: CategoryKind
  from?: string
  to?: string
  sort?: TransactionSort
}

export type TransactionPage = Page<TransactionDto> & { sum: number; currency: Currency }

export type BudgetStatus = 'on_track' | 'almost_spent' | 'over_budget'

export const budgetStatuses: readonly BudgetStatus[] = ['on_track', 'almost_spent', 'over_budget']

export type BudgetDto = {
  id: string
  categoryId: string
  period: string
  limit: number
  spent: number
  remaining: number
  status: BudgetStatus
  perDay: number | null
}

export type BudgetInput = { categoryId: string; period: string; limit: number }

export type BudgetSummary = { planned: number; spent: number; left: number; daysLeft: number }

export type BudgetPage = Page<BudgetDto> & {
  period: string
  from: string
  to: string
  currency: Currency
  summary: BudgetSummary
}

export type BudgetCopyInput = { period: string }

export type BudgetCopyResult = { copied: number }

export type GoalStatus = 'active' | 'reached' | 'overdue'

export const goalStatuses: readonly GoalStatus[] = ['active', 'reached', 'overdue']

export type GoalDto = {
  id: string
  name: string
  target: number
  saved: number
  remaining: number
  percent: number
  monthly: number | null
  status: GoalStatus
  deadline: string | null
  accountId: string | null
  currency: Currency
}

export type GoalInput = { name: string; target: number; deadline: string | null; accountId: string | null }

export type GoalSummary = { saved: number; monthly: number; active: number }

export type GoalPage = Page<GoalDto> & { currency: Currency; summary: GoalSummary }

export type GoalContributionInput = { amount: number; date: string; fromAccountId?: string; rate?: number }

export type OverviewRange = 'week' | 'month' | 'year'

export const overviewRanges: readonly OverviewRange[] = ['week', 'month', 'year']

export const isOverviewRange = (value: unknown): value is OverviewRange =>
  overviewRanges.includes(value as OverviewRange)

export type OverviewTotal = { amount: number; count: number; change: number | null }

export type SpendingSlice = { categoryId: string | null; name: string | null; amount: number; percent: number }

export type OverviewMonth = {
  period: string
  from: string
  to: string
  planned: number
  spent: number
  left: number
  daysLeft: number
  perDay: number | null
  budgets: number
}

export type OverviewBudgetDto = {
  id: string
  categoryId: string
  name: string
  limit: number
  spent: number
  remaining: number
  status: BudgetStatus
}

export type OverviewTransactionDto = {
  id: string
  kind: CategoryKind
  date: string
  title: string
  categoryName: string
  accountName: string
  amount: number
}

export type OverviewGoalDto = Pick<GoalDto, 'id' | 'name' | 'target' | 'saved' | 'percent' | 'status' | 'deadline'>

export type OverviewDto = {
  range: OverviewRange
  from: string
  to: string
  previousFrom: string
  previousTo: string
  currency: Currency
  balance: { amount: number; accounts: number }
  income: OverviewTotal
  expense: OverviewTotal
  averageExpense: number | null
  transactionCount: number
  spending: SpendingSlice[]
  month: OverviewMonth
  topBudgets: OverviewBudgetDto[]
  recent: OverviewTransactionDto[]
  today: OverviewTransactionDto[]
  goals: OverviewGoalDto[]
  goalCount: number
  hasTransactions: boolean
}
