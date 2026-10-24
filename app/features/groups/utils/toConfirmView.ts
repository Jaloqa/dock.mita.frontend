import type {
  GroupDto,
  GroupExpenseTerms,
  GroupRepaymentTerms,
  GroupTerms,
  ToConfirmItemDto,
} from '../../../shared/api/contract'
import type { Currency } from '../../../shared/money/currencies'
import { categoryLabel, memberName } from './groupView'

type Translate = (key: string, named?: Record<string, unknown>) => string

type GroupNames = Pick<GroupDto, 'members' | 'categories'>

export type ChangedField =
  | 'amount'
  | 'share'
  | 'date'
  | 'category'
  | 'tags'
  | 'description'
  | 'covers'
  | 'coverShares'
  | 'groupAmount'
  | 'currency'
  | 'member'

export type TermsView = {
  group: GroupNames | undefined
  groupCurrency: Currency
  formatDate: (date: string) => string
}

const noNames: GroupNames = { members: [], categories: [] }

export const isRepaymentTerms = (terms: GroupTerms): terms is GroupRepaymentTerms => 'direction' in terms

const sameList = (first: readonly string[], second: readonly string[]) =>
  first.length === second.length && first.every((value, index) => value === second[index])

const coverKeys = (terms: GroupRepaymentTerms) =>
  (terms.covers ?? []).map((cover) => `${cover.expenseId}:${cover.groupAmount}`)

const coveredTotal = (terms: GroupRepaymentTerms) =>
  (terms.covers ?? []).reduce((sum, cover) => sum + cover.groupAmount, 0)

export function itemTitle(t: Translate, item: ToConfirmItemDto, group: GroupNames | undefined): string {
  const terms = item.current ?? item.previous
  if (terms === null) return ''
  const names = group ?? noNames
  if (isRepaymentTerms(terms)) {
    const name = memberName(names, terms.memberId)
    return t(terms.direction === 'paid' ? 'groups.toConfirm.paymentTo' : 'groups.toConfirm.paymentFrom', { name })
  }
  return terms.description ?? categoryLabel(t, names, terms.categoryId)
}

export const changeLabel = (t: Translate, item: Pick<ToConfirmItemDto, 'change'>): string =>
  t(`groups.toConfirm.change.${item.change}`)

function changedExpenseFields(before: GroupExpenseTerms, after: GroupExpenseTerms): ChangedField[] {
  const fields: ChangedField[] = []
  if (before.amount !== after.amount) fields.push('amount')
  if (before.currency !== after.currency) fields.push('currency')
  if (before.share !== after.share) fields.push('share')
  if (before.date !== after.date) fields.push('date')
  if (before.categoryId !== after.categoryId) fields.push('category')
  if (!sameList(before.tags, after.tags)) fields.push('tags')
  if (before.description !== after.description) fields.push('description')
  return fields
}

function changedRepaymentFields(before: GroupRepaymentTerms, after: GroupRepaymentTerms): ChangedField[] {
  const fields: ChangedField[] = []
  if (before.amount !== after.amount) fields.push('amount')
  if (before.currency !== after.currency) fields.push('currency')
  if (
    before.groupAmount !== undefined &&
    after.groupAmount !== undefined &&
    before.groupAmount !== after.groupAmount &&
    before.amount === after.amount &&
    before.currency === after.currency
  ) {
    fields.push('groupAmount')
  }
  if (before.memberId !== after.memberId || before.direction !== after.direction) fields.push('member')
  if (before.date !== after.date) fields.push('date')
  if (!sameList(coverKeys(before), coverKeys(after))) {
    fields.push(coveredTotal(before) === coveredTotal(after) ? 'coverShares' : 'covers')
  }
  return fields
}

export function changedFields(item: Pick<ToConfirmItemDto, 'change' | 'current' | 'previous'>): ChangedField[] {
  const { change, current, previous } = item
  if (change !== 'changed' || current === null || previous === null) return []
  if (isRepaymentTerms(current) && isRepaymentTerms(previous)) return changedRepaymentFields(previous, current)
  if (!isRepaymentTerms(current) && !isRepaymentTerms(previous)) return changedExpenseFields(previous, current)
  return []
}

export function fieldValue(
  t: Translate,
  format: (minor: number, currency: Currency) => string,
  view: TermsView,
  field: ChangedField,
  terms: GroupTerms,
): string {
  const none = t('groups.toConfirm.none')
  if (isRepaymentTerms(terms)) {
    if (field === 'amount') return format(terms.amount, terms.currency)
    if (field === 'date') return view.formatDate(terms.date)
    if (field === 'currency') return terms.currency
    if (field === 'member') {
      const name = memberName(view.group ?? noNames, terms.memberId)
      return t(terms.direction === 'paid' ? 'groups.toConfirm.with.paid' : 'groups.toConfirm.with.received', { name })
    }
    if (field === 'groupAmount')
      return terms.groupAmount === undefined ? none : format(terms.groupAmount, view.groupCurrency)
    if (field === 'coverShares') {
      const shares = (terms.covers ?? []).map((cover) => format(cover.groupAmount, view.groupCurrency))
      return shares.length > 0 ? shares.join(', ') : none
    }
    if (field !== 'covers') return ''
    const covered = coveredTotal(terms)
    return covered > 0 ? format(covered, view.groupCurrency) : none
  }
  if (field === 'amount') return format(terms.amount, terms.currency)
  if (field === 'share') return format(terms.share, terms.currency)
  if (field === 'date') return view.formatDate(terms.date)
  if (field === 'currency') return terms.currency
  if (field === 'category') return categoryLabel(t, view.group ?? noNames, terms.categoryId)
  if (field === 'tags') return terms.tags.length > 0 ? terms.tags.join(', ') : none
  if (field === 'description') return terms.description ?? none
  return ''
}
