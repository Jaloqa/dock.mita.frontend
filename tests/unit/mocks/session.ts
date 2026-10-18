import { createMockApi, type MockApi } from '../../../mocks/api'
import { defaultHandlers } from '../../../mocks/handlers'

export const loggedInMockApi = (userId = 'usr_anna'): MockApi => {
  const api = createMockApi({ register: defaultHandlers })
  api.db.state.activeUserId = userId
  return api
}
