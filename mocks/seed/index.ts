import { todayIso } from '../../app/shared/period/period'
import type { MockState } from '../db'
import { demoAccounts } from './accounts'
import { demoBudgets } from './budgets'
import { demoCategories } from './categories'
import { demoDebts, withDebtHistory } from './debts'
import { demoGoals } from './goals'
import { demoGroups } from './groups'
import { seedRates } from './rates'
import { demoTags } from './tags'
import { demoTransactions, withTransactionHistory } from './transactions'
import { demoTransfers } from './transfers'
import { demoSettings, demoUsers } from './users'

export const seedState = (today: string = todayIso()): MockState => {
  const rates = seedRates(today)
  const settings = demoSettings()
  const designed = demoAccounts()
  const transactions = demoTransactions(today, designed, rates, settings)
  const transfers = demoTransfers(today, designed, rates)
  const { goals, contributions } = demoGoals(today, settings, designed, transfers, rates)
  const { debts, repayments } = demoDebts(today)
  return {
    version: 4,
    activeUserId: null,
    simulateErrors: false,
    users: demoUsers(),
    credentials: [],
    settings,
    rates,
    accounts: withDebtHistory(withTransactionHistory(designed, transactions), debts, repayments),
    transfers,
    categories: demoCategories(),
    tags: demoTags(),
    transactions,
    budgets: demoBudgets(today, settings),
    goals,
    goalContributions: contributions,
    debts,
    debtRepayments: repayments,
    ...demoGroups(today),
  }
}
