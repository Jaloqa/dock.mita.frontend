import type { MockState } from '../db'
import { demoSettings, demoUsers } from './users'

export const seedState = (): MockState => ({
  version: 1,
  activeUserId: 'usr_anna',
  simulateErrors: false,
  users: demoUsers(),
  settings: demoSettings(),
})
