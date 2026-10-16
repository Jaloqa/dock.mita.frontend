import { convertMinor } from '../../app/shared/money/money'
import { addDaysIso } from '../../app/shared/period/period'
import type { AccountRow, RateRow, TransferRow } from '../db'
import { rateOn } from '../rates'

type Planned = { userId: string; daysAgo: number; from: string; to: string; amount: number; note?: string }

const planned: Planned[] = [
  {
    userId: 'usr_anna',
    daysAgo: 98,
    from: 'acc_anna_card',
    to: 'acc_anna_savings',
    amount: 320_000,
    note: 'Fundusz awaryjny',
  },
  {
    userId: 'usr_anna',
    daysAgo: 68,
    from: 'acc_anna_card',
    to: 'acc_anna_savings',
    amount: 100_000,
    note: 'Fundusz awaryjny',
  },
  {
    userId: 'usr_anna',
    daysAgo: 52,
    from: 'acc_anna_card',
    to: 'acc_anna_eur',
    amount: 200_000,
    note: 'Wakacje w Hiszpanii',
  },
  { userId: 'usr_anna', daysAgo: 45, from: 'acc_anna_card', to: 'acc_anna_cash', amount: 30_000 },
  {
    userId: 'usr_anna',
    daysAgo: 38,
    from: 'acc_anna_card',
    to: 'acc_anna_savings',
    amount: 100_000,
    note: 'Fundusz awaryjny',
  },
  { userId: 'usr_anna', daysAgo: 14, from: 'acc_anna_card', to: 'acc_anna_cash', amount: 30_000 },
  {
    userId: 'usr_anna',
    daysAgo: 8,
    from: 'acc_anna_card',
    to: 'acc_anna_savings',
    amount: 100_000,
    note: 'Fundusz awaryjny',
  },
  {
    userId: 'usr_oleh',
    daysAgo: 80,
    from: 'acc_oleh_card',
    to: 'acc_oleh_usd',
    amount: 1_000_000,
    note: 'Ноутбук',
  },
  { userId: 'usr_oleh', daysAgo: 36, from: 'acc_oleh_card', to: 'acc_oleh_cash', amount: 200_000 },
  {
    userId: 'usr_oleh',
    daysAgo: 20,
    from: 'acc_oleh_card',
    to: 'acc_oleh_usd',
    amount: 1_000_000,
    note: 'Ноутбук',
  },
  { userId: 'usr_oleh', daysAgo: 5, from: 'acc_oleh_card', to: 'acc_oleh_cash', amount: 200_000 },
]

export function demoTransfers(
  today: string,
  accounts: readonly AccountRow[],
  rates: readonly RateRow[],
): TransferRow[] {
  const currencyOf = (id: string) => accounts.find((account) => account.id === id)?.currency ?? 'PLN'
  return planned.map((plan, index) => {
    const date = addDaysIso(today, -plan.daysAgo)
    const rate = rateOn(rates, date, currencyOf(plan.from), currencyOf(plan.to))
    return {
      id: `trf_seed_${index + 1}`,
      userId: plan.userId,
      date,
      fromAccountId: plan.from,
      toAccountId: plan.to,
      fromAmount: plan.amount,
      toAmount: convertMinor(plan.amount, rate),
      rate,
      note: plan.note ?? null,
    }
  })
}
