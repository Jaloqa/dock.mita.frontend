import type { MockRouter } from '../router'
import { registerAccountHandlers } from './accounts'
import { registerBudgetHandlers } from './budgets'
import { registerCategoryHandlers } from './categories'
import { registerDemoHandlers } from './demo'
import { registerGoalHandlers } from './goals'
import { registerOverviewHandlers } from './overview'
import { registerRateHandlers } from './rates'
import { registerReportHandlers } from './reports'
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
  registerBudgetHandlers,
  registerGoalHandlers,
  registerOverviewHandlers,
  registerReportHandlers,
]
