import type { MockRouter } from '../router'
import { registerDemoHandlers } from './demo'
import { registerRateHandlers } from './rates'
import { registerUserHandlers } from './users'

export const defaultHandlers: ((router: MockRouter) => void)[] = [
  registerUserHandlers,
  registerDemoHandlers,
  registerRateHandlers,
]
