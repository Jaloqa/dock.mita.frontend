import type { Currency } from '../../../app/shared/money/currencies'
import { createMockApi, type MockApi } from '../../../mocks/api'
import { defaultHandlers } from '../../../mocks/handlers'

export const loggedInMockApi = (userId = 'usr_anna'): MockApi => {
  const api = createMockApi({ register: defaultHandlers })
  api.db.state.activeUserId = userId
  return api
}

export const quoteRate = (mock: MockApi, from: Currency, value: number, date: string): void => {
  mock.db.state.rates = [...mock.db.state.rates.filter((row) => row.from !== from), { date, from, to: 'PLN', value }]
}
