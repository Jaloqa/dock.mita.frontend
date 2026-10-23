import type { DebtDirection } from '../../app/shared/api/contract'
import type { Currency } from '../../app/shared/money/currencies'
import { addDaysIso } from '../../app/shared/period/period'
import type { AccountRow, DebtRepaymentRow, DebtRow } from '../db'
import { debtLegs } from '../ledger'

type PlannedDebt = {
  key: string
  userId: string
  short: string
  direction: DebtDirection
  counterparty: string
  amount: number
  currency: Currency
  daysAgo: number
  dueInDays: number | null
  accountId: string | null
  repayments: readonly (readonly [daysAgo: number, amount: number])[]
}

const plans: readonly PlannedDebt[] = [
  {
    key: 'max',
    userId: 'usr_anna',
    short: 'anna',
    direction: 'lent',
    counterparty: 'Max',
    amount: 50_000,
    currency: 'PLN',
    daysAgo: 20,
    dueInDays: 10,
    accountId: 'acc_anna_cash',
    repayments: [[5, 10_000]],
  },
  {
    key: 'mama',
    userId: 'usr_anna',
    short: 'anna',
    direction: 'borrowed',
    counterparty: 'Mama',
    amount: 200_000,
    currency: 'PLN',
    daysAgo: 60,
    dueInDays: null,
    accountId: 'acc_anna_card',
    repayments: [[30, 50_000]],
  },
  {
    key: 'kasia',
    userId: 'usr_anna',
    short: 'anna',
    direction: 'lent',
    counterparty: 'Kasia',
    amount: 5_000,
    currency: 'EUR',
    daysAgo: 40,
    dueInDays: -5,
    accountId: null,
    repayments: [],
  },
  {
    key: 'tomek',
    userId: 'usr_anna',
    short: 'anna',
    direction: 'lent',
    counterparty: 'Tomek',
    amount: 12_000,
    currency: 'PLN',
    daysAgo: 90,
    dueInDays: null,
    accountId: null,
    repayments: [[70, 12_000]],
  },
  {
    key: 'andrii',
    userId: 'usr_oleh',
    short: 'oleh',
    direction: 'borrowed',
    counterparty: 'Андрій',
    amount: 300_000,
    currency: 'UAH',
    daysAgo: 15,
    dueInDays: null,
    accountId: null,
    repayments: [],
  },
]

export function demoDebts(today: string): { debts: DebtRow[]; repayments: DebtRepaymentRow[] } {
  const debts: DebtRow[] = []
  const repayments: DebtRepaymentRow[] = []
  for (const plan of plans) {
    const id = `debt_seed_${plan.short}_${plan.key}`
    const date = addDaysIso(today, -plan.daysAgo)
    const onAccount = (amount: number): number | null => (plan.accountId === null ? null : amount)
    debts.push({
      id,
      userId: plan.userId,
      direction: plan.direction,
      counterparty: plan.counterparty,
      amount: plan.amount,
      currency: plan.currency,
      date,
      dueDate: plan.dueInDays === null ? null : addDaysIso(today, plan.dueInDays),
      accountId: plan.accountId,
      accountAmount: onAccount(plan.amount),
      rate: plan.accountId === null ? null : 1,
      note: null,
      repaid: plan.repayments.reduce((sum, [, amount]) => sum + amount, 0),
      createdAt: `${date}T09:00:00Z`,
    })
    for (const [index, [daysAgo, amount]] of plan.repayments.entries()) {
      repayments.push({
        id: `rep_seed_${plan.short}_${plan.key}_${index + 1}`,
        userId: plan.userId,
        debtId: id,
        date: addDaysIso(today, -daysAgo),
        amount,
        currency: plan.currency,
        rate: 1,
        debtAmount: amount,
        accountId: plan.accountId,
        accountAmount: onAccount(amount),
        note: null,
        createdAt: `${addDaysIso(today, -daysAgo)}T09:00:00Z`,
      })
    }
  }
  return { debts, repayments }
}

export function withDebtHistory(
  accounts: readonly AccountRow[],
  debts: readonly DebtRow[],
  repayments: readonly DebtRepaymentRow[],
): AccountRow[] {
  const legs = debtLegs(debts, repayments)
  return accounts.map((account) => ({
    ...account,
    openingBalance: legs
      .filter((leg) => leg.accountId === account.id)
      .reduce((opening, leg) => opening - leg.amount, account.openingBalance),
  }))
}
