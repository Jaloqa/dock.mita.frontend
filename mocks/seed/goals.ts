import { type Currency, convertMinor } from '../../app/shared/money/money'
import { addDaysIso } from '../../app/shared/period/period'
import type { AccountRow, GoalContributionRow, GoalRow, RateRow, SettingsRow, TransferRow } from '../db'
import { addMonthsToKey, monthKeyOf } from '../goals'
import { rateOn } from '../rates'

type PlannedGoal = {
  key: string
  userId: string
  short: string
  name: string
  target: number
  deadlineIn: number | null
  accountId: string | null
  contributions: readonly (readonly [daysAgo: number, amount: number])[]
}

const plans: readonly PlannedGoal[] = [
  {
    key: 'vacation',
    userId: 'usr_anna',
    short: 'anna',
    name: 'Wakacje',
    target: 800_000,
    deadlineIn: 8,
    accountId: null,
    contributions: [
      [160, 120_000],
      [130, 120_000],
      [100, 120_000],
      [50, 60_000],
    ],
  },
  {
    key: 'emergency',
    userId: 'usr_anna',
    short: 'anna',
    name: 'Fundusz awaryjny',
    target: 2_000_000,
    deadlineIn: null,
    accountId: 'acc_anna_savings',
    contributions: [],
  },
  {
    key: 'laptop',
    userId: 'usr_anna',
    short: 'anna',
    name: 'Nowy laptop',
    target: 500_000,
    deadlineIn: 3,
    accountId: null,
    contributions: [
      [170, 150_000],
      [140, 120_000],
      [110, 60_000],
      [20, 60_000],
    ],
  },
  {
    key: 'laptop',
    userId: 'usr_oleh',
    short: 'oleh',
    name: 'Ноутбук',
    target: 6_000_000,
    deadlineIn: 5,
    accountId: 'acc_oleh_usd',
    contributions: [],
  },
  {
    key: 'reserve',
    userId: 'usr_oleh',
    short: 'oleh',
    name: 'Подушка безпеки',
    target: 10_000_000,
    deadlineIn: null,
    accountId: null,
    contributions: [
      [170, 1_500_000],
      [120, 1_000_000],
      [60, 500_000],
      [30, 500_000],
    ],
  },
  {
    key: 'bike',
    userId: 'usr_oleh',
    short: 'oleh',
    name: 'Велосипед',
    target: 1_800_000,
    deadlineIn: 2,
    accountId: null,
    contributions: [
      [150, 800_000],
      [100, 600_000],
      [45, 400_000],
    ],
  },
]

type Draft = Omit<GoalContributionRow, 'id' | 'userId' | 'goalId'>

export function demoGoals(
  today: string,
  settings: readonly SettingsRow[],
  accounts: readonly AccountRow[],
  transfers: readonly TransferRow[],
  rates: readonly RateRow[],
): { goals: GoalRow[]; contributions: GoalContributionRow[] } {
  const currencyOf = (id: string): Currency => accounts.find((account) => account.id === id)?.currency ?? 'PLN'
  const goals: GoalRow[] = []
  const contributions: GoalContributionRow[] = []
  for (const plan of plans) {
    const base = settings.find((row) => row.userId === plan.userId)?.baseCurrency ?? 'PLN'
    const linked = plan.accountId
    const drafts: Draft[] =
      linked === null
        ? plan.contributions.map(([daysAgo, amount]) => ({
            date: addDaysIso(today, -daysAgo),
            amount,
            currency: base,
            fromAccountId: null,
            transferId: null,
            baseAmount: amount,
            baseCurrency: base,
          }))
        : transfers
            .filter((transfer) => transfer.toAccountId === linked && transfer.note === plan.name)
            .map((transfer) => {
              const received = currencyOf(linked)
              return {
                date: transfer.date,
                amount: transfer.fromAmount,
                currency: currencyOf(transfer.fromAccountId),
                fromAccountId: transfer.fromAccountId,
                transferId: transfer.id,
                baseAmount:
                  received === base
                    ? transfer.toAmount
                    : convertMinor(transfer.toAmount, rateOn(rates, transfer.date, received, base)),
                baseCurrency: base,
              }
            })
    const id = `goal_seed_${plan.short}_${plan.key}`
    goals.push({
      id,
      userId: plan.userId,
      name: plan.name,
      target: plan.target,
      saved: drafts.reduce((sum, draft) => sum + draft.baseAmount, 0),
      currency: base,
      deadline: plan.deadlineIn === null ? null : addMonthsToKey(monthKeyOf(today), plan.deadlineIn),
      accountId: linked,
      createdAt: `${addDaysIso(today, -175)}T09:00:00Z`,
    })
    contributions.push(
      ...drafts.map(
        (draft, index): GoalContributionRow => ({
          id: `gcn_seed_${plan.short}_${plan.key}_${index + 1}`,
          userId: plan.userId,
          goalId: id,
          ...draft,
        }),
      ),
    )
  }
  return { goals, contributions }
}
