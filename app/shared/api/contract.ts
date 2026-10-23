import type { BaseCurrency, Currency } from '../money/currencies'
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

export type UpdateMeRequest = { name: string; email: string }

export type RegisterRequest = { name: string; email: string; password: string }

export type LoginRequest = { email: string; password: string }

export type DeleteAccountRequest = { password: string }

export type SettingsDto = {
  baseCurrency: BaseCurrency
  locale: Locale
  monthStartDay: MonthStart
  theme: ThemePreference
  notifications: NotificationPrefs
}

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number }

export type DemoStateDto = {
  activeUserId: string | null
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

export const TAG_NAME_MAX = 30

export const TAGS_PER_TRANSACTION_MAX = 10

export type TransactionTagDto = { id: string; name: string }

export type TagDto = { id: string; name: string; usage: number }

export type TagInput = { name: string }

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
  tags: TransactionTagDto[]
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
  tags?: string[]
}

export type TransactionQuery = {
  search?: string
  categoryId?: string
  accountId?: string
  tagIds?: string
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

export const COUNTERPARTY_MAX = 40

export const DEBT_NOTE_MAX = 200

export type DebtDirection = 'lent' | 'borrowed'

export const debtDirections: readonly DebtDirection[] = ['lent', 'borrowed']

export type DebtStatus = 'open' | 'settled'

export const debtStatuses: readonly DebtStatus[] = ['open', 'settled']

export type DebtDto = {
  id: string
  direction: DebtDirection
  counterparty: string
  amount: number
  currency: Currency
  repaid: number
  remaining: number
  status: DebtStatus
  overdue: boolean
  date: string
  dueDate: string | null
  accountId: string | null
  accountAmount: number | null
  rate: number | null
  note: string | null
  repayments: number
}

export type DebtInput = {
  direction: DebtDirection
  counterparty: string
  amount: number
  currency: Currency
  date: string
  dueDate?: string | null
  accountId?: string | null
  rate?: number
  note?: string | null
}

export type DebtSummary = { owedToMe: number; owedByMe: number; open: number; overdue: number }

export type DebtPage = Page<DebtDto> & { currency: Currency; summary: DebtSummary }

export type DebtRepaymentDto = {
  id: string
  date: string
  amount: number
  currency: Currency
  rate: number
  debtAmount: number
  accountId: string | null
  accountAmount: number | null
  note: string | null
}

export type DebtRepaymentInput = {
  date: string
  amount: number
  currency: Currency
  rate?: number
  accountId?: string | null
  note?: string | null
}

export const GROUP_NAME_MAX = 40

export const GROUP_MEMBERS_MAX = 50

export const GROUP_CATEGORIES_MAX = 100

export const EXPENSE_DESCRIPTION_MAX = 100

export const GROUP_NOTE_MAX = 200

export const GROUP_MEMBER_HEADER = 'X-Group-Member'

export const SHARE_TOKEN_LENGTH = 43

export const standardGroupCategories = [
  'groceries',
  'transport',
  'housing',
  'cafes',
  'health',
  'shopping',
  'leisure',
  'gifts',
  'other',
] as const

export type StandardGroupCategory = (typeof standardGroupCategories)[number]

export type GroupSummaryDto = { id: string; name: string; currency: Currency; members: number; total: number }

export type GroupMemberDto = { id: string; name: string; inUse: boolean }

export type GroupCategoryDto = { id: string; standard: boolean; name: string | null }

export type GroupDto = {
  id: string
  name: string
  currency: Currency
  currencyLocked: boolean
  total: number
  members: GroupMemberDto[]
  categories: GroupCategoryDto[]
  shareToken: string | null
}

export type GroupInput = { name: string; currency: Currency; members: string[] }

export type GroupUpdateInput = { name: string; currency: Currency }

export type GroupNameInput = { name: string }

export type GroupActorKind = 'owner' | 'member'

export type GroupActorDto = { kind: GroupActorKind; memberId: string | null; name: string }

export type GroupShareDto = { memberId: string; amount: number; groupAmount: number }

export type GroupSplitMode = 'equal' | 'exact'

export const groupSplitModes: readonly GroupSplitMode[] = ['equal', 'exact']

export type GroupSplitInput =
  | { mode: 'equal'; memberIds: string[] }
  | { mode: 'exact'; shares: { memberId: string; amount: number }[] }

export type GroupExpenseDto = {
  id: string
  payerId: string
  amount: number
  currency: Currency
  date: string
  categoryId: string
  tags: string[]
  description: string | null
  rate: number
  rateManual: boolean
  groupAmount: number
  split: GroupSplitMode
  shares: GroupShareDto[]
  deleted: boolean
  createdBy: GroupActorDto
  createdAt: string
  updatedBy: GroupActorDto | null
  updatedAt: string | null
}

export type GroupExpenseInput = {
  payerId: string
  amount: number
  currency: Currency
  date: string
  categoryId?: string | null
  tags?: string[]
  description?: string | null
  rate?: number
  split?: GroupSplitInput | null
}

export type GroupExpenseState = {
  payerId: string
  amount: number
  currency: Currency
  date: string
  categoryId: string
  tags: string[]
  description: string | null
  rate: number
  rateManual: boolean
  groupAmount: number
  split: GroupSplitMode
  shares: GroupShareDto[]
}

export type GroupRepaymentDto = {
  id: string
  fromMemberId: string
  toMemberId: string
  amount: number
  currency: Currency
  date: string
  rate: number
  rateManual: boolean
  groupAmount: number
  note: string | null
  deleted: boolean
  createdBy: GroupActorDto
  createdAt: string
  updatedBy: GroupActorDto | null
  updatedAt: string | null
}

export type GroupRepaymentInput = {
  fromMemberId: string
  toMemberId: string
  amount: number
  currency: Currency
  date: string
  rate?: number
  note?: string | null
}

export type GroupRepaymentState = {
  fromMemberId: string
  toMemberId: string
  amount: number
  currency: Currency
  date: string
  rate: number
  rateManual: boolean
  groupAmount: number
  note: string | null
}

export type GroupEntryAction = 'created' | 'updated' | 'deleted' | 'restored'

export const groupEntryActions: readonly GroupEntryAction[] = ['created', 'updated', 'deleted', 'restored']

export type GroupEntryEvent<T> = { id: string; action: GroupEntryAction; at: string; actor: GroupActorDto; state: T }

export type GroupMemberBalanceDto = {
  memberId: string
  paid: number
  share: number
  sent: number
  received: number
  balance: number
}

export type GroupTransferDto = { fromMemberId: string; toMemberId: string; amount: number }

export type GroupBalancesDto = {
  currency: Currency
  groupCurrency: Currency
  total: number
  members: GroupMemberBalanceDto[]
  transfers: GroupTransferDto[]
}

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
  categoryId: string
  categoryName: string
  categoryColor: CategoryColor
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
  debts: DebtSummary
  income: OverviewTotal
  expense: OverviewTotal
  averageExpense: number | null
  transactionCount: number
  spending: SpendingSlice[]
  month: OverviewMonth
  topBudgets: OverviewBudgetDto[]
  recent: OverviewTransactionDto[]
  goals: OverviewGoalDto[]
  goalCount: number
  hasTransactions: boolean
}

export type ReportRange = '3m' | '6m' | '12m'

export const reportRanges: readonly ReportRange[] = ['3m', '6m', '12m']

export const reportRangePeriods: Readonly<Record<ReportRange, number>> = { '3m': 3, '6m': 6, '12m': 12 }

export const isReportRange = (value: unknown): value is ReportRange => reportRanges.includes(value as ReportRange)

export type ReportPeriodDto = { period: string; from: string; to: string; income: number; expense: number }

export type ReportStructureItemDto = {
  categoryId: string
  name: string
  color: CategoryColor
  amount: number
  percent: number
}

export type ReportStructureDto = {
  period: string
  from: string
  to: string
  total: number
  items: ReportStructureItemDto[]
}

export type ReportDto = {
  range: ReportRange
  from: string
  to: string
  currency: Currency
  periods: ReportPeriodDto[]
  totals: { income: number; expense: number }
  averageIncome: number
  averageExpense: number
  savingsRate: number | null
  structure: ReportStructureDto
  hasTransactions: boolean
}
