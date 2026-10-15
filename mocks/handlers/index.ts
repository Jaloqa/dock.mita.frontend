import type { MockRouter } from '../router'
import { registerDemoHandlers } from './demo'
import { registerUserHandlers } from './users'

export const defaultHandlers: ((router: MockRouter) => void)[] = [registerUserHandlers, registerDemoHandlers]
