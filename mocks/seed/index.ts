import { todayIso } from '../../app/shared/period/period'
import type { MockState } from '../db'
import { demoAccounts } from './accounts'
import { demoCategories } from './categories'
import { seedRates } from './rates'
import { demoTransfers } from './transfers'
import { demoSettings, demoUsers } from './users'

export const seedState = (today: string = todayIso()): MockState => {
  const rates = seedRates(today)
  const accounts = demoAccounts()
  return {
    version: 1,
    activeUserId: 'usr_anna',
    simulateErrors: false,
    users: demoUsers(),
    settings: demoSettings(),
    rates,
    accounts,
    transfers: demoTransfers(today, accounts, rates),
    categories: demoCategories(),
  }
}
