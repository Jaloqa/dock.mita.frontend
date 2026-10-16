import { todayIso } from '../../app/shared/period/period'
import type { MockState } from '../db'
import { demoAccounts } from './accounts'
import { demoBudgets } from './budgets'
import { demoCategories } from './categories'
import { seedRates } from './rates'
import { demoTransactions, withTransactionHistory } from './transactions'
import { demoTransfers } from './transfers'
import { demoSettings, demoUsers } from './users'

export const seedState = (today: string = todayIso()): MockState => {
  const rates = seedRates(today)
  const settings = demoSettings()
  const designed = demoAccounts()
  const transactions = demoTransactions(today, designed, rates, settings)
  return {
    version: 1,
    activeUserId: 'usr_anna',
    simulateErrors: false,
    users: demoUsers(),
    settings,
    rates,
    accounts: withTransactionHistory(designed, transactions),
    transfers: demoTransfers(today, designed, rates),
    categories: demoCategories(),
    transactions,
    budgets: demoBudgets(today, settings),
    goals: [],
    goalContributions: [],
  }
}
