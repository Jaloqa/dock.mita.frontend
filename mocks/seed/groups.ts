import type { GroupEntryAction, GroupExpenseState, GroupRepaymentState } from '../../app/shared/api/contract'
import type { Currency } from '../../app/shared/money/currencies'
import { addDaysIso } from '../../app/shared/period/period'
import type { GroupEventRow, GroupExpenseRow, GroupRepaymentRow, MockState } from '../db'
import { equalShares, priceEntry } from '../groups'

type DemoGroups = Pick<
  MockState,
  'groups' | 'groupMembers' | 'groupCategories' | 'groupExpenses' | 'groupRepayments' | 'groupEvents'
>

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

const GROUP_ID = 'grp_albania'
const OWNER_ID = 'usr_anna'
const GROUP_CURRENCY: Currency = 'EUR'
const SHARE_TOKEN = 'albania-2026-demo-link-0123456789abcdefghij'

const [anna, olya, max, kasia] = ['gmb_anna', 'gmb_olya', 'gmb_max', 'gmb_kasia'] as const
const everyone = [anna, olya, max, kasia]

const members = [
  [anna, 'Anna'],
  [olya, 'Olya'],
  [max, 'Max'],
  [kasia, 'Kasia'],
] as const

const expensePlans: readonly PlannedExpense[] = [
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
]

const repaymentPlans: readonly PlannedRepayment[] = [
  { key: 'kasia_anna', daysAgo: 7, fromMemberId: kasia, toMemberId: anna, amount: 2_000, currency: 'EUR' },
]

const clock = (step: number): string => {
  const minutes = 18 * 60 + 30 + 35 * step
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`
}

export function demoGroups(today: string): DemoGroups {
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
      groupId: GROUP_ID,
      kind,
      entryId,
      action,
      at,
      actorUserId: OWNER_ID,
      actorMemberId: null,
      state: structuredClone(state),
    })
  }

  const groupExpenses = expensePlans.map((plan): GroupExpenseRow => {
    const id = `gex_${plan.key}`
    const date = addDaysIso(today, -plan.daysAgo)
    const stateOf = (amount: number): GroupExpenseState => {
      const price = priceEntry([], {
        date,
        today,
        amount,
        currency: plan.currency,
        groupCurrency: GROUP_CURRENCY,
        rate: plan.rate,
      })
      return {
        payerId: plan.payerId,
        amount,
        currency: plan.currency,
        date,
        categoryId: plan.categoryId,
        tags: [...plan.tags],
        description: plan.description,
        ...price,
        split: 'equal',
        shares: equalShares(amount, price.groupAmount, plan.among, plan.payerId),
      }
    }
    const [first, ...edits] = plan.amounts
    const createdAt = when(plan.daysAgo, clock(0))
    record('expense', id, 1, 'created', createdAt, stateOf(first))
    for (const [index, amount] of edits.entries()) {
      record('expense', id, index + 2, 'updated', when(plan.daysAgo, clock(index + 1)), stateOf(amount))
    }
    const current = stateOf(edits.at(-1) ?? first)
    if (plan.deleted) record('expense', id, edits.length + 2, 'deleted', when(plan.daysAgo - 1, '08:20:00'), current)
    return { id, ...current, deleted: plan.deleted ?? false, groupId: GROUP_ID, createdAt }
  })

  const groupRepayments = repaymentPlans.map((plan): GroupRepaymentRow => {
    const id = `gpay_${plan.key}`
    const date = addDaysIso(today, -plan.daysAgo)
    const price = priceEntry([], {
      date,
      today,
      amount: plan.amount,
      currency: plan.currency,
      groupCurrency: GROUP_CURRENCY,
    })
    const state: GroupRepaymentState = {
      fromMemberId: plan.fromMemberId,
      toMemberId: plan.toMemberId,
      amount: plan.amount,
      currency: plan.currency,
      date,
      ...price,
      note: null,
    }
    const createdAt = when(plan.daysAgo, '20:10:00')
    record('repayment', id, 1, 'created', createdAt, state)
    return { id, ...state, deleted: false, groupId: GROUP_ID, createdAt }
  })

  return {
    groups: [
      {
        id: GROUP_ID,
        userId: OWNER_ID,
        name: 'Albania 2026',
        currency: GROUP_CURRENCY,
        createdAt: when(12, '10:00:00'),
        shareToken: SHARE_TOKEN,
      },
    ],
    groupMembers: members.map(([id, name], position) => ({ id, groupId: GROUP_ID, name, position })),
    groupCategories: [{ id: 'gcat_beach', groupId: GROUP_ID, name: 'Beach', createdAt: when(12, '10:05:00') }],
    groupExpenses,
    groupRepayments,
    groupEvents: events.sort((a, b) => a.at.localeCompare(b.at)),
  }
}
