import { todayIso } from '../../app/shared/period/period'
import type { MockState } from '../db'
import { demoAccounts } from './accounts'
import { seedRates } from './rates'
import { demoSettings, demoUsers } from './users'

export const seedState = (today: string = todayIso()): MockState => ({
  version: 1,
  activeUserId: 'usr_anna',
  simulateErrors: false,
  users: demoUsers(),
  settings: demoSettings(),
  rates: seedRates(today),
  accounts: demoAccounts(),
  transfers: [],
})
