import type { MockRouter } from '../router'
import { registerAccountHandlers } from './accounts'
import { registerDemoHandlers } from './demo'
import { registerRateHandlers } from './rates'
import { registerTransferHandlers } from './transfers'
import { registerUserHandlers } from './users'

export const defaultHandlers: ((router: MockRouter) => void)[] = [
  registerUserHandlers,
  registerDemoHandlers,
  registerRateHandlers,
  registerAccountHandlers,
  registerTransferHandlers,
]
