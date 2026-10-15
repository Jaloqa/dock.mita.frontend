import type { MockRouter } from '../router'
import { registerAccountHandlers } from './accounts'
import { registerCategoryHandlers } from './categories'
import { registerDemoHandlers } from './demo'
import { registerRateHandlers } from './rates'
import { registerTransactionHandlers } from './transactions'
import { registerTransferHandlers } from './transfers'
import { registerUserHandlers } from './users'

export const defaultHandlers: ((router: MockRouter) => void)[] = [
  registerUserHandlers,
  registerDemoHandlers,
  registerRateHandlers,
  registerAccountHandlers,
  registerTransferHandlers,
  registerCategoryHandlers,
  registerTransactionHandlers,
]
