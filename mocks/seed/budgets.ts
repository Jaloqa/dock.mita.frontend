import { periodFor, shiftPeriod } from '../../app/shared/period/period'
import type { BudgetRow, SettingsRow } from '../db'

export const BUDGET_HISTORY_PERIODS = 3

const plans = [
  {
    userId: 'usr_anna',
    short: 'anna',
    limits: [
      ['housing', 216_000],
      ['groceries', 180_000],
      ['leisure', 60_000],
      ['transport', 50_000],
      ['health', 30_000],
      ['cafes', 34_000],
      ['shopping', 80_000],
      ['gifts', 50_000],
    ],
  },
  {
    userId: 'usr_oleh',
    short: 'oleh',
    limits: [
      ['housing', 1_700_000],
      ['groceries', 1_200_000],
      ['transport', 300_000],
      ['cafes', 150_000],
      ['subscriptions', 60_000],
      ['leisure', 100_000],
      ['health', 80_000],
      ['shopping', 200_000],
    ],
  },
] as const

export function demoBudgets(today: string, settings: readonly SettingsRow[]): BudgetRow[] {
  return plans.flatMap((plan) => {
    const userSettings = settings.find((row) => row.userId === plan.userId)
    const start = userSettings?.monthStartDay ?? 1
    const currency = userSettings?.baseCurrency ?? 'PLN'
    const current = periodFor(today, start).key
    const periods = Array.from(
      { length: BUDGET_HISTORY_PERIODS + 1 },
      (_, index) => shiftPeriod(current, index - BUDGET_HISTORY_PERIODS, start).key,
    )
    return periods.flatMap((period) =>
      plan.limits.map(
        ([category, limit]): BudgetRow => ({
          id: `bud_seed_${plan.short}_${period}_${category}`,
          userId: plan.userId,
          categoryId: `cat_${plan.short}_expense_${category}`,
          period,
          limit,
          currency,
        }),
      ),
    )
  })
}
