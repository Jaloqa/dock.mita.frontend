import type {
  GroupExpenseTerms,
  GroupRepaymentTerms,
  GroupTerms,
  ToConfirmItemDto,
  ToConfirmLineDto,
  ToConfirmSuggestionDto,
} from '../app/shared/api/contract'
import { allocateMinor, type Currency, sumMinor } from '../app/shared/money/money'
import { coversOf } from './covers'
import type {
  AccountRow,
  CategoryRow,
  GroupConfirmationRow,
  GroupEntryKind,
  GroupExpenseRow,
  GroupRepaymentRow,
  GroupRow,
  MockState,
  TransactionRow,
} from './db'
import { actorView, entryEvents, isStandardCategory } from './groups'
import { newId } from './ids'
import { tagRefs, upsertTags } from './tags'

type ToConfirmLine = ToConfirmLineDto & { weight: number }

export type ToConfirmItem = Omit<ToConfirmItemDto, 'lines'> & {
  lines: ToConfirmLine[]
  otherWeight: number
  confirmation: GroupConfirmationRow | undefined
}

export type ConfirmedLine = { categoryId: string | null; newCategory: string | null; title: string; tags: string[] }

export type Pricing = {
  rate: number
  accountAmount: number
  baseCurrency: Currency
  baseOf: (lineAmount: number, part: number) => number
}

type Entry = { amount: number; currency: Currency; date: string; sign: 1 | -1 }

type Membership = { group: GroupRow; memberId: string }

type Candidate = {
  kind: GroupEntryKind
  entryId: string
  membership: Membership
  currency: Currency
  current: GroupTerms | null
  confirmation: GroupConfirmationRow | undefined
}

type Booking = Pick<ToConfirmItem, 'lines' | 'other' | 'otherWeight'>

type UserCategories = { expense: CategoryRow[]; otherId: string | null; transferName: string | undefined }

type CategoryChoice = Pick<ToConfirmSuggestionDto, 'categoryId' | 'newCategory'>

const isExpenseTerms = (terms: GroupTerms): terms is GroupExpenseTerms => !('direction' in terms)

const sameName = (first: string, second: string): boolean => first.toLocaleLowerCase() === second.toLocaleLowerCase()

function expenseTerms(row: GroupExpenseRow, memberId: string): GroupExpenseTerms | null {
  if (row.deleted || row.payerId !== memberId) return null
  return {
    amount: row.amount,
    currency: row.currency,
    date: row.date,
    share: sumMinor(row.shares.filter((share) => share.memberId === memberId).map((share) => share.amount)),
    categoryId: row.categoryId,
    tags: [...row.tags],
    description: row.description,
  }
}

function repaymentTerms(state: MockState, row: GroupRepaymentRow, memberId: string): GroupRepaymentTerms | null {
  if (row.deleted) return null
  const terms = (direction: GroupRepaymentTerms['direction'], otherMemberId: string): GroupRepaymentTerms => ({
    direction,
    memberId: otherMemberId,
    amount: row.amount,
    currency: row.currency,
    date: row.date,
  })
  if (row.fromMemberId === memberId) {
    return { ...terms('paid', row.toMemberId), groupAmount: row.groupAmount, covers: coversOf(state, row.id) }
  }
  return row.toMemberId === memberId ? terms('received', row.fromMemberId) : null
}

function canonicalTerms(terms: GroupTerms | null): string | null {
  if (terms === null) return null
  if (isExpenseTerms(terms)) {
    const { amount, currency, date, share, categoryId, tags, description } = terms
    return JSON.stringify({ amount, currency, date, share, categoryId, tags, description })
  }
  const { direction, memberId, amount, currency, date, groupAmount, covers } = terms
  return JSON.stringify({
    direction,
    memberId,
    amount,
    currency,
    date,
    groupAmount,
    covers: covers?.map(({ expenseId, groupAmount: covered }) => ({ expenseId, groupAmount: covered })),
  })
}

export const expenseCategoryNamed = (state: MockState, userId: string, name: string): CategoryRow | undefined =>
  state.categories.find((row) => row.userId === userId && row.kind === 'expense' && sameName(row.name, name))

function userCategories(state: MockState, userId: string): UserCategories {
  const own = state.categories.filter((row) => row.userId === userId)
  const expense = own.filter((row) => row.kind === 'expense' && row.system !== 'transfer')
  return {
    expense,
    otherId: expense.find((row) => row.system === 'other')?.id ?? null,
    transferName: own.find((row) => row.system === 'transfer')?.name,
  }
}

function categoryFor(state: MockState, categories: UserCategories, expense: GroupExpenseRow): CategoryChoice {
  const other: CategoryChoice = { categoryId: categories.otherId, newCategory: null }
  if (isStandardCategory(expense.categoryId)) {
    const keyed = categories.expense.find((row) => row.standardKey === expense.categoryId)
    return keyed ? { categoryId: keyed.id, newCategory: null } : other
  }
  const name = state.groupCategories.find((row) => row.id === expense.categoryId)?.name
  if (name === undefined) return other
  if (categories.transferName !== undefined && sameName(categories.transferName, name)) return other
  const named = categories.expense.find((row) => sameName(row.name, name))
  return named ? { categoryId: named.id, newCategory: null } : { categoryId: null, newCategory: name }
}

function earlierTransaction(
  state: MockState,
  userId: string,
  confirmation: GroupConfirmationRow | undefined,
  expenseId: string,
): TransactionRow | undefined {
  if (!confirmation) return undefined
  const link = state.groupConfirmationTransactions.find(
    (row) =>
      row.confirmationId === confirmation.id &&
      row.expenseId === expenseId &&
      state.transactions.some((transaction) => transaction.id === row.transactionId && transaction.userId === userId),
  )
  return state.transactions.find((transaction) => transaction.id === link?.transactionId)
}

function suggestionFor(
  state: MockState,
  userId: string,
  categories: UserCategories,
  candidate: Candidate,
  expense: GroupExpenseRow,
): ToConfirmSuggestionDto {
  const earlier = earlierTransaction(state, userId, candidate.confirmation, expense.id)
  if (earlier) {
    const kept = categories.expense.some((row) => row.id === earlier.categoryId)
    return {
      ...(kept ? { categoryId: earlier.categoryId, newCategory: null } : categoryFor(state, categories, expense)),
      title: earlier.title,
      tags: tagRefs(state, earlier.tagIds).map((tag) => tag.name),
    }
  }
  return {
    ...categoryFor(state, categories, expense),
    title: expense.description ?? candidate.membership.group.name,
    tags: [...expense.tags],
  }
}

const inOrder = (weights: readonly number[]): number[] => weights.map((_, index) => index)

function bookingOf(
  candidate: Candidate,
  lineOf: (expenseId: string, amount: number, weight: number) => ToConfirmLine,
): Booking {
  const { current } = candidate
  if (current === null) return { lines: [], other: 0, otherWeight: 0 }
  if (isExpenseTerms(current)) {
    if (current.share === 0) return { lines: [], other: current.amount, otherWeight: current.amount }
    const rest = current.amount - current.share
    return { lines: [lineOf(candidate.entryId, current.share, current.share)], other: rest, otherWeight: rest }
  }
  const { groupAmount, covers } = current
  if (groupAmount === undefined || covers === undefined) {
    return { lines: [], other: current.amount, otherWeight: current.amount }
  }
  const uncovered = groupAmount - sumMinor(covers.map((cover) => cover.groupAmount))
  const weights = [...covers.map((cover) => cover.groupAmount), uncovered]
  const parts = allocateMinor(current.amount, weights, inOrder(weights))
  return {
    lines: covers.map((cover, index) => lineOf(cover.expenseId, parts[index] ?? 0, cover.groupAmount)),
    other: parts.at(-1) ?? 0,
    otherWeight: uncovered,
  }
}

function membershipsOf(state: MockState, userId: string): Membership[] {
  return state.groupMembers.flatMap((member) => {
    const group = member.userId === userId ? state.groups.find((row) => row.id === member.groupId) : undefined
    return group ? [{ group, memberId: member.id }] : []
  })
}

function candidatesOf(state: MockState, userId: string, membership: Membership): Candidate[] {
  const { group, memberId } = membership
  const decisions = state.groupConfirmations.filter((row) => row.userId === userId && row.groupId === group.id)
  const decided = (kind: GroupEntryKind, entryId: string) =>
    decisions.find((row) => row.kind === kind && row.entryId === entryId)
  const expenses = state.groupExpenses
    .filter((row) => row.groupId === group.id)
    .flatMap((row): Candidate[] => {
      const confirmation = decided('expense', row.id)
      if (!confirmation && (row.deleted || row.payerId !== memberId)) return []
      const current = expenseTerms(row, memberId)
      return [{ kind: 'expense', entryId: row.id, membership, currency: row.currency, current, confirmation }]
    })
  const repayments = state.groupRepayments
    .filter((row) => row.groupId === group.id)
    .flatMap((row): Candidate[] => {
      const confirmation = decided('repayment', row.id)
      const involved = row.fromMemberId === memberId || row.toMemberId === memberId
      if (!confirmation && (row.deleted || !involved)) return []
      const current = repaymentTerms(state, row, memberId)
      return [{ kind: 'repayment', entryId: row.id, membership, currency: row.currency, current, confirmation }]
    })
  return [...expenses, ...repayments]
}

function isPending({ current, confirmation }: Candidate): boolean {
  const terms = canonicalTerms(current)
  return (
    terms !== canonicalTerms(confirmation?.handledTerms ?? null) &&
    terms !== canonicalTerms(confirmation?.confirmedTerms ?? null)
  )
}

function itemOf(state: MockState, userId: string, categories: UserCategories, candidate: Candidate): ToConfirmItem {
  const { kind, entryId, membership, current, confirmation } = candidate
  const newest = entryEvents(state, kind, entryId).at(-1)
  if (!newest) throw new Error('Every entry has a history event.')
  const lineOf = (expenseId: string, amount: number, weight: number): ToConfirmLine => {
    const expense = state.groupExpenses.find((row) => row.id === expenseId)
    if (!expense) throw new Error('Every line is for an expense of the group.')
    return {
      expenseId,
      description: expense.description,
      amount,
      currency: candidate.currency,
      suggestion: suggestionFor(state, userId, categories, candidate, expense),
      weight,
    }
  }
  const { lines, other, otherWeight } = bookingOf(candidate, lineOf)
  const accountId = confirmation?.accountId ?? null
  const account = state.accounts.find((row) => row.id === accountId && row.userId === userId)
  const suggestable = account !== undefined && (!account.archived || (confirmation?.confirmedTerms ?? null) !== null)
  return {
    kind,
    entryId,
    groupId: membership.group.id,
    groupName: membership.group.name,
    groupCurrency: membership.group.currency,
    change: current === null ? 'removed' : (confirmation?.confirmedTerms ?? null) === null ? 'new' : 'changed',
    version: `${newest.id}.${membership.memberId}`,
    at: newest.at,
    actor: actorView(state, membership.group, newest),
    current,
    previous: confirmation?.confirmedTerms ?? null,
    other,
    lines,
    suggestedAccountId: suggestable ? accountId : null,
    otherWeight,
    confirmation,
  }
}

export function pendingItems(state: MockState, userId: string): ToConfirmItem[] {
  const categories = userCategories(state, userId)
  return membershipsOf(state, userId)
    .flatMap((membership) => candidatesOf(state, userId, membership))
    .filter(isPending)
    .map((candidate) => itemOf(state, userId, categories, candidate))
    .sort((a, b) => b.at.localeCompare(a.at) || b.entryId.localeCompare(a.entryId))
}

export const findPendingItem = (
  state: MockState,
  userId: string,
  kind: GroupEntryKind,
  entryId: string | undefined,
): ToConfirmItem | undefined =>
  pendingItems(state, userId).find((item) => item.kind === kind && item.entryId === entryId)

export const itemView = (item: ToConfirmItem): ToConfirmItemDto => ({
  kind: item.kind,
  entryId: item.entryId,
  groupId: item.groupId,
  groupName: item.groupName,
  groupCurrency: item.groupCurrency,
  change: item.change,
  version: item.version,
  at: item.at,
  actor: item.actor,
  current: item.current,
  previous: item.previous,
  other: item.other,
  lines: item.lines.map(({ weight: _weight, ...line }) => line),
  suggestedAccountId: item.suggestedAccountId,
})

export function entryOf(terms: GroupTerms): Entry {
  const { amount, currency, date } = terms
  const received = !isExpenseTerms(terms) && terms.direction === 'received'
  return { amount, currency, date, sign: received ? 1 : -1 }
}

export function removeRecords(state: MockState, userId: string, confirmation: GroupConfirmationRow | undefined): void {
  if (!confirmation) return
  const booked = new Set(
    state.groupConfirmationTransactions
      .filter((link) => link.confirmationId === confirmation.id)
      .map((link) => link.transactionId),
  )
  state.transactions = state.transactions.filter((row) => row.userId !== userId || !booked.has(row.id))
  state.groupConfirmationTransactions = state.groupConfirmationTransactions.filter(
    (link) => link.confirmationId !== confirmation.id,
  )
  state.groupLegs = state.groupLegs.filter((leg) => leg.confirmationId !== confirmation.id)
}

export function decide(
  state: MockState,
  userId: string,
  item: ToConfirmItem,
  decision: Partial<Pick<GroupConfirmationRow, 'handledTerms' | 'confirmedTerms' | 'accountId'>>,
): GroupConfirmationRow {
  const decidedAt = new Date().toISOString()
  const confirmation = item.confirmation ?? {
    id: newId('gconf'),
    userId,
    groupId: item.groupId,
    kind: item.kind,
    entryId: item.entryId,
    handledTerms: null,
    confirmedTerms: null,
    accountId: null,
    decidedAt,
  }
  if (!item.confirmation) state.groupConfirmations.push(confirmation)
  Object.assign(confirmation, structuredClone(decision), { decidedAt })
  return confirmation
}

function categoryNamed(state: MockState, userId: string, name: string): string {
  const existing = expenseCategoryNamed(state, userId, name)
  if (existing) return existing.id
  const created: CategoryRow = {
    id: newId('cat'),
    userId,
    name,
    kind: 'expense',
    color: 'chart-4',
    system: null,
    standardKey: null,
  }
  state.categories.push(created)
  return created.id
}

export function bookItem(
  state: MockState,
  userId: string,
  item: ToConfirmItem,
  account: AccountRow,
  lines: readonly ConfirmedLine[],
  pricing: Pricing,
): void {
  if (item.current === null) throw new Error('Only an item with current terms books records.')
  const entry = entryOf(item.current)
  removeRecords(state, userId, item.confirmation)
  const confirmation = decide(state, userId, item, {
    handledTerms: item.current,
    confirmedTerms: item.current,
    accountId: account.id,
  })
  const weights = [...item.lines.map((line) => line.weight), item.otherWeight]
  const parts = allocateMinor(pricing.accountAmount, weights, inOrder(weights))
  let leg = parts.at(-1) ?? 0
  for (const [index, line] of item.lines.entries()) {
    const part = parts[index] ?? 0
    const input = lines[index]
    if (!input) throw new Error('Every line of the item has an input line.')
    if (line.amount <= 0 || part <= 0) {
      leg += part
      continue
    }
    const transaction: TransactionRow = {
      id: newId('txn'),
      userId,
      kind: 'expense',
      date: entry.date,
      title: input.title,
      note: null,
      categoryId: input.categoryId ?? categoryNamed(state, userId, input.newCategory ?? ''),
      accountId: account.id,
      amount: line.amount,
      currency: line.currency,
      accountAmount: part,
      rate: pricing.rate,
      baseAmount: pricing.baseOf(line.amount, part),
      accountCurrency: account.currency,
      baseCurrency: pricing.baseCurrency,
      tagIds: upsertTags(state, userId, input.tags),
    }
    state.transactions.push(transaction)
    state.groupConfirmationTransactions.push({
      transactionId: transaction.id,
      confirmationId: confirmation.id,
      expenseId: line.expenseId,
    })
  }
  if (leg === 0) return
  state.groupLegs.push({
    id: newId('gleg'),
    userId,
    confirmationId: confirmation.id,
    accountId: account.id,
    date: entry.date,
    accountAmount: entry.sign * leg,
  })
}
