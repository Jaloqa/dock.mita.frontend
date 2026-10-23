import type { GroupEntryAction, GroupExpenseState, GroupRepaymentState } from '../../app/shared/api/contract'
import type { Currency } from '../../app/shared/money/currencies'
import { addDaysIso } from '../../app/shared/period/period'
import type { GroupEventRow, GroupExpenseRow, GroupRepaymentRow, MockState } from '../db'
import { equalShares, priceEntry } from '../groups'

type DemoGroups = Pick<
  MockState,
  'groups' | 'groupMembers' | 'groupCategories' | 'groupExpenses' | 'groupRepayments' | 'groupEvents'
>

type PlannedMember = { id: string; name: string; userId?: string; invitedEmail?: string }

type PlannedExpense = {
  key: string
  daysAgo: number
  payerId: string
  amounts: readonly [number, ...number[]]
  currency: Currency
  categoryId: string
  tags: readonly string[]
  description: string
  rate?: number
  among: readonly string[]
  deleted?: boolean
}

type PlannedRepayment = {
  key: string
  daysAgo: number
  fromMemberId: string
  toMemberId: string
  amount: number
  currency: Currency
}

type PlannedGroup = {
  id: string
  ownerId: string
  name: string
  currency: Currency
  createdDaysAgo: number
  shareToken: string | null
  members: readonly PlannedMember[]
  categories: readonly { id: string; name: string }[]
  expenses: readonly PlannedExpense[]
  repayments: readonly PlannedRepayment[]
}

const [anna, olya, max, kasia] = ['gmb_anna', 'gmb_olya', 'gmb_max', 'gmb_kasia'] as const
const everyone = [anna, olya, max, kasia]

const [oleh, krakowAnna, taras] = ['gmb_oleh', 'gmb_k_anna', 'gmb_taras'] as const

const albania: PlannedGroup = {
  id: 'grp_albania',
  ownerId: 'usr_anna',
  name: 'Albania 2026',
  currency: 'EUR',
  createdDaysAgo: 12,
  shareToken: 'albania-2026-demo-link-0123456789abcdefghij',
  members: [
    { id: anna, name: 'Anna' },
    { id: olya, name: 'Olya' },
    { id: max, name: 'Max' },
    { id: kasia, name: 'Kasia' },
  ],
  categories: [{ id: 'gcat_beach', name: 'Beach' }],
  expenses: [
    {
      key: 'dinner',
      daysAgo: 10,
      payerId: anna,
      amounts: [10_000, 12_000],
      currency: 'EUR',
      categoryId: 'cafes',
      tags: ['dinner'],
      description: 'Dinner',
      among: everyone,
    },
    {
      key: 'groceries',
      daysAgo: 9,
      payerId: olya,
      amounts: [300_000],
      currency: 'ALL',
      categoryId: 'groceries',
      tags: [],
      description: 'Groceries',
      rate: 0.0102326,
      among: everyone,
    },
    {
      key: 'boat',
      daysAgo: 8,
      payerId: max,
      amounts: [4_000],
      currency: 'EUR',
      categoryId: 'leisure',
      tags: [],
      description: 'Boat trip',
      among: [anna, max],
    },
    {
      key: 'taxi',
      daysAgo: 6,
      payerId: kasia,
      amounts: [1_500],
      currency: 'EUR',
      categoryId: 'transport',
      tags: [],
      description: 'Taxi',
      among: everyone,
      deleted: true,
    },
  ],
  repayments: [
    { key: 'kasia_anna', daysAgo: 7, fromMemberId: kasia, toMemberId: anna, amount: 2_000, currency: 'EUR' },
  ],
}

const krakow: PlannedGroup = {
  id: 'grp_krakow',
  ownerId: 'usr_oleh',
  name: 'Kraków',
  currency: 'PLN',
  createdDaysAgo: 6,
  shareToken: null,
  members: [
    { id: oleh, name: 'Oleh', userId: 'usr_oleh' },
    { id: krakowAnna, name: 'Anna', invitedEmail: 'anna@demo.mita.app' },
    { id: taras, name: 'Taras' },
  ],
  categories: [],
  expenses: [
    {
      key: 'pierogi',
      daysAgo: 5,
      payerId: oleh,
      amounts: [30_000],
      currency: 'PLN',
      categoryId: 'cafes',
      tags: [],
      description: 'Pierogi',
      among: [oleh, krakowAnna, taras],
    },
  ],
  repayments: [],
}

const clock = (step: number): string => {
  const minutes = 18 * 60 + 30 + 35 * step
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`
}

function buildGroup(plan: PlannedGroup, today: string): DemoGroups {
  const when = (daysAgo: number, time: string): string => `${addDaysIso(today, -daysAgo)}T${time}.000Z`
  const events: GroupEventRow[] = []
  const record = (
    kind: GroupEventRow['kind'],
    entryId: string,
    number: number,
    action: GroupEntryAction,
    at: string,
    state: GroupExpenseState | GroupRepaymentState,
  ): void => {
    events.push({
      id: `gevt_${entryId}_${number}`,
      groupId: plan.id,
      kind,
      entryId,
      action,
      at,
      actorUserId: plan.ownerId,
      actorMemberId: null,
      state: structuredClone(state),
    })
  }

  const groupExpenses = plan.expenses.map((expense): GroupExpenseRow => {
    const id = `gex_${expense.key}`
    const date = addDaysIso(today, -expense.daysAgo)
    const stateOf = (amount: number): GroupExpenseState => {
      const price = priceEntry([], {
        date,
        today,
        amount,
        currency: expense.currency,
        groupCurrency: plan.currency,
        rate: expense.rate,
      })
      return {
        payerId: expense.payerId,
        amount,
        currency: expense.currency,
        date,
        categoryId: expense.categoryId,
        tags: [...expense.tags],
        description: expense.description,
        ...price,
        split: 'equal',
        shares: equalShares(amount, price.groupAmount, expense.among, expense.payerId),
      }
    }
    const [first, ...edits] = expense.amounts
    const createdAt = when(expense.daysAgo, clock(0))
    record('expense', id, 1, 'created', createdAt, stateOf(first))
    for (const [index, amount] of edits.entries()) {
      record('expense', id, index + 2, 'updated', when(expense.daysAgo, clock(index + 1)), stateOf(amount))
    }
    const current = stateOf(edits.at(-1) ?? first)
    if (expense.deleted) {
      record('expense', id, edits.length + 2, 'deleted', when(expense.daysAgo - 1, '08:20:00'), current)
    }
    return { id, ...current, deleted: expense.deleted ?? false, groupId: plan.id, createdAt }
  })

  const groupRepayments = plan.repayments.map((repayment): GroupRepaymentRow => {
    const id = `gpay_${repayment.key}`
    const date = addDaysIso(today, -repayment.daysAgo)
    const price = priceEntry([], {
      date,
      today,
      amount: repayment.amount,
      currency: repayment.currency,
      groupCurrency: plan.currency,
    })
    const state: GroupRepaymentState = {
      fromMemberId: repayment.fromMemberId,
      toMemberId: repayment.toMemberId,
      amount: repayment.amount,
      currency: repayment.currency,
      date,
      ...price,
      note: null,
    }
    const createdAt = when(repayment.daysAgo, '20:10:00')
    record('repayment', id, 1, 'created', createdAt, state)
    return { id, ...state, deleted: false, groupId: plan.id, createdAt }
  })

  return {
    groups: [
      {
        id: plan.id,
        userId: plan.ownerId,
        name: plan.name,
        currency: plan.currency,
        createdAt: when(plan.createdDaysAgo, '10:00:00'),
        shareToken: plan.shareToken,
      },
    ],
    groupMembers: plan.members.map((member, position) => ({
      id: member.id,
      groupId: plan.id,
      name: member.name,
      position,
      userId: member.userId ?? null,
      invitedEmail: member.invitedEmail ?? null,
      invitedAt: member.invitedEmail === undefined ? null : when(plan.createdDaysAgo, '10:05:00'),
    })),
    groupCategories: plan.categories.map((category) => ({
      id: category.id,
      groupId: plan.id,
      name: category.name,
      createdAt: when(plan.createdDaysAgo, '10:05:00'),
    })),
    groupExpenses,
    groupRepayments,
    groupEvents: events,
  }
}

export function demoGroups(today: string): DemoGroups {
  const built = [albania, krakow].map((plan) => buildGroup(plan, today))
  return {
    groups: built.flatMap((rows) => rows.groups),
    groupMembers: built.flatMap((rows) => rows.groupMembers),
    groupCategories: built.flatMap((rows) => rows.groupCategories),
    groupExpenses: built.flatMap((rows) => rows.groupExpenses),
    groupRepayments: built.flatMap((rows) => rows.groupRepayments),
    groupEvents: built.flatMap((rows) => rows.groupEvents).sort((a, b) => a.at.localeCompare(b.at)),
  }
}
