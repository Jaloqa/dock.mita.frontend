import { describe, expect, it } from 'bun:test'
import { changedFields, changeLabel, fieldValue, itemTitle } from '../../../../app/features/groups/utils/toConfirmView'
import type {
  GroupDto,
  GroupExpenseTerms,
  GroupRepaymentTerms,
  ToConfirmItemDto,
} from '../../../../app/shared/api/contract'

const t = (key: string, named?: Record<string, unknown>) =>
  named ? `${key}(${Object.values(named).map(String).join(';')})` : key

const group: Pick<GroupDto, 'members' | 'categories'> = {
  members: [
    { id: 'gmb_anna', name: 'Anna', inUse: true, linked: true, linkedName: 'Anna' },
    { id: 'gmb_kasia', name: 'Kasia', inUse: true, linked: false, linkedName: null },
  ],
  categories: [{ id: 'gcat_beach', name: 'Beach' }],
}

const dinner: GroupExpenseTerms = {
  amount: 12_000,
  currency: 'EUR',
  date: '2026-10-14',
  share: 3000,
  categoryId: 'cafes',
  tags: ['dinner'],
  description: 'Dinner',
}

const payment: GroupRepaymentTerms = {
  direction: 'received',
  memberId: 'gmb_kasia',
  amount: 2000,
  currency: 'EUR',
  date: '2026-10-20',
}

const item = (overrides: Partial<ToConfirmItemDto>): ToConfirmItemDto => ({
  kind: 'expense',
  entryId: 'gexp_dinner',
  groupId: 'grp_albania',
  groupName: 'Albania 2026',
  groupCurrency: 'EUR',
  change: 'new',
  version: 'v1',
  at: '2026-10-20T10:00:00.000Z',
  actor: { kind: 'owner', memberId: null, name: 'Anna' },
  current: dinner,
  previous: null,
  other: 9000,
  lines: [],
  suggestedAccountId: null,
  ...overrides,
})

describe('to confirm item title', () => {
  it('uses the description of an expense', () => {
    expect(itemTitle(t, item({}), group)).toBe('Dinner')
  })

  it('falls back to the category label without a description', () => {
    const noDescription = item({ current: { ...dinner, description: null, categoryId: 'gcat_beach' } })
    expect(itemTitle(t, noDescription, group)).toBe('Beach')
    expect(itemTitle(t, item({ current: { ...dinner, description: null } }), group)).toBe('groups.categories.cafes')
  })

  it('names the other member of a repayment', () => {
    expect(itemTitle(t, item({ kind: 'repayment', current: payment }), group)).toBe(
      'groups.toConfirm.paymentFrom(Kasia)',
    )
    const paid: GroupRepaymentTerms = { ...payment, direction: 'paid' }
    expect(itemTitle(t, item({ kind: 'repayment', current: paid }), group)).toBe('groups.toConfirm.paymentTo(Kasia)')
  })

  it('names a removed entry by its previous terms', () => {
    const removed = item({ change: 'removed', current: null, previous: dinner })
    expect(itemTitle(t, removed, group)).toBe('Dinner')
  })

  it('does not fail while the group is not loaded', () => {
    expect(itemTitle(t, item({ kind: 'repayment', current: payment }), undefined)).toBe(
      'groups.toConfirm.paymentFrom()',
    )
    expect(itemTitle(t, item({ current: { ...dinner, description: null } }), undefined)).toBe('groups.categories.cafes')
  })
})

describe('to confirm change label', () => {
  it('names each kind of change', () => {
    expect(changeLabel(t, item({ change: 'new' }))).toBe('groups.toConfirm.change.new')
    expect(changeLabel(t, item({ change: 'changed' }))).toBe('groups.toConfirm.change.changed')
    expect(changeLabel(t, item({ change: 'removed' }))).toBe('groups.toConfirm.change.removed')
  })
})

describe('changed fields', () => {
  it('is empty unless the item changed', () => {
    expect(changedFields(item({ change: 'new' }))).toEqual([])
    expect(changedFields(item({ change: 'removed', current: null, previous: dinner }))).toEqual([])
  })

  it('lists the expense terms that differ', () => {
    const edited = item({
      change: 'changed',
      current: { ...dinner, amount: 10_000, share: 2500, date: '2026-10-15', categoryId: 'leisure', tags: [] },
      previous: dinner,
    })
    expect(changedFields(edited)).toEqual(['amount', 'share', 'date', 'category', 'tags'])
    const described = item({ change: 'changed', current: { ...dinner, description: 'Supper' }, previous: dinner })
    expect(changedFields(described)).toEqual(['description'])
  })

  it('compares tags in their order', () => {
    const before = { ...dinner, tags: ['a', 'b'] }
    const after = item({ change: 'changed', current: { ...dinner, tags: ['b', 'a'] }, previous: before })
    expect(changedFields(after)).toEqual(['tags'])
  })

  it('detects a change of the expense currency alone', () => {
    const edited = item({ change: 'changed', current: { ...dinner, currency: 'PLN' }, previous: dinner })
    expect(changedFields(edited)).toEqual(['currency'])
  })

  it('detects a change of the repayment member, direction or currency alone', () => {
    const asItem = (current: GroupRepaymentTerms) =>
      item({ kind: 'repayment', change: 'changed', current, previous: payment })
    expect(changedFields(asItem({ ...payment, memberId: 'gmb_anna' }))).toEqual(['member'])
    expect(changedFields(asItem({ ...payment, direction: 'paid' }))).toEqual(['member'])
    expect(changedFields(asItem({ ...payment, currency: 'PLN' }))).toEqual(['currency'])
  })

  it('lists the repayment terms that differ', () => {
    const before: GroupRepaymentTerms = { ...payment, direction: 'paid', groupAmount: 2000, covers: [] }
    const after: GroupRepaymentTerms = {
      ...before,
      amount: 2500,
      covers: [{ expenseId: 'gexp_dinner', groupAmount: 2000 }],
    }
    const edited = item({ kind: 'repayment', change: 'changed', current: after, previous: before })
    expect(changedFields(edited)).toEqual(['amount', 'covers'])
  })
})

describe('changed fields of a payment', () => {
  const paid: GroupRepaymentTerms = {
    direction: 'paid',
    memberId: 'gmb_kasia',
    amount: 2000,
    currency: 'PLN',
    date: '2026-10-20',
    groupAmount: 465,
    covers: [{ expenseId: 'gexp_dinner', groupAmount: 465 }],
  }
  const asItem = (current: GroupRepaymentTerms, previous: GroupRepaymentTerms = paid) =>
    item({ kind: 'repayment', change: 'changed', current, previous })

  it('lists the group amount when only the rate changed', () => {
    const rated = asItem({ ...paid, groupAmount: 470, covers: [{ expenseId: 'gexp_dinner', groupAmount: 470 }] })
    expect(changedFields(rated)).toEqual(['groupAmount', 'covers'])
    expect(changedFields(asItem({ ...paid, groupAmount: 470 }))).toEqual(['groupAmount'])
  })

  it('does not list the group amount when the amount or the currency changed with it', () => {
    expect(changedFields(asItem({ ...paid, amount: 2500, groupAmount: 580 }))).toEqual(['amount'])
    expect(changedFields(asItem({ ...paid, currency: 'EUR', groupAmount: 2000 }))).toEqual(['currency'])
  })

  it('does not list the group amount of a payment received', () => {
    const received: GroupRepaymentTerms = { ...payment }
    expect(changedFields(asItem({ ...received, amount: 2500 }, received))).toEqual(['amount'])
  })

  it('lists the covered shares when the covers move with the same total', () => {
    const moved = asItem({
      ...paid,
      groupAmount: 465,
      covers: [
        { expenseId: 'gexp_boat', groupAmount: 300 },
        { expenseId: 'gexp_dinner', groupAmount: 165 },
      ],
    })
    expect(changedFields(moved)).toEqual(['coverShares'])
  })
})

describe('field value', () => {
  const format = (minor: number, currency: string) => `${currency} ${minor}`
  const view = { group, groupCurrency: 'EUR' as const, formatDate: (date: string) => `on ${date}` }

  it('formats the amounts in the entry currency', () => {
    expect(fieldValue(t, format, view, 'amount', dinner)).toBe('EUR 12000')
    expect(fieldValue(t, format, view, 'share', dinner)).toBe('EUR 3000')
  })

  it('shows the date, category, tags and description', () => {
    expect(fieldValue(t, format, view, 'date', dinner)).toBe('on 2026-10-14')
    expect(fieldValue(t, format, view, 'date', payment)).toBe('on 2026-10-20')
    expect(fieldValue(t, format, view, 'currency', dinner)).toBe('EUR')
    expect(fieldValue(t, format, view, 'category', dinner)).toBe('groups.categories.cafes')
    expect(fieldValue(t, format, view, 'tags', dinner)).toBe('dinner')
    expect(fieldValue(t, format, view, 'tags', { ...dinner, tags: [] })).toBe('groups.toConfirm.none')
    expect(fieldValue(t, format, view, 'description', { ...dinner, description: null })).toBe('groups.toConfirm.none')
  })

  it('names the member and the direction of a payment', () => {
    expect(fieldValue(t, format, view, 'member', payment)).toBe('groups.toConfirm.with.received(Kasia)')
    expect(fieldValue(t, format, view, 'member', { ...payment, direction: 'paid', memberId: 'gmb_anna' })).toBe(
      'groups.toConfirm.with.paid(Anna)',
    )
  })

  it('shows the group amount and the covered shares of a payment', () => {
    const paid: GroupRepaymentTerms = {
      ...payment,
      direction: 'paid',
      groupAmount: 465,
      covers: [
        { expenseId: 'gexp_boat', groupAmount: 300 },
        { expenseId: 'gexp_dinner', groupAmount: 165 },
      ],
    }
    expect(fieldValue(t, format, view, 'groupAmount', paid)).toBe('EUR 465')
    expect(fieldValue(t, format, view, 'groupAmount', payment)).toBe('groups.toConfirm.none')
    expect(fieldValue(t, format, view, 'coverShares', paid)).toBe('EUR 300, EUR 165')
    expect(fieldValue(t, format, view, 'coverShares', { ...paid, covers: [] })).toBe('groups.toConfirm.none')
  })

  it('totals the covers of a payment', () => {
    const covered: GroupRepaymentTerms = {
      ...payment,
      direction: 'paid',
      covers: [{ expenseId: 'gexp_dinner', groupAmount: 2000 }],
    }
    expect(fieldValue(t, format, view, 'covers', covered)).toBe('EUR 2000')
    expect(fieldValue(t, format, view, 'covers', { ...covered, covers: [] })).toBe('groups.toConfirm.none')
  })
})
