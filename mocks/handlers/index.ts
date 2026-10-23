import type { MockRouter } from '../router'
import { registerAccountHandlers } from './accounts'
import { registerAuthHandlers } from './auth'
import { registerBudgetHandlers } from './budgets'
import { registerCategoryHandlers } from './categories'
import { registerDebtHandlers } from './debts'
import { registerDemoHandlers } from './demo'
import { registerGoalHandlers } from './goals'
import { registerGroupExpenseHandlers } from './groupExpenses'
import { registerGroupRepaymentHandlers } from './groupRepayments'
import { registerGroupHandlers } from './groups'
import { registerOverviewHandlers } from './overview'
import { registerRateHandlers } from './rates'
import { registerReportHandlers } from './reports'
import { registerTagHandlers } from './tags'
import { registerTransactionHandlers } from './transactions'
import { registerTransferHandlers } from './transfers'
import { registerUserHandlers } from './users'

export const defaultHandlers: ((router: MockRouter) => void)[] = [
  registerAuthHandlers,
  registerUserHandlers,
  registerDemoHandlers,
  registerRateHandlers,
  registerAccountHandlers,
  registerTransferHandlers,
  registerCategoryHandlers,
  registerTagHandlers,
  registerTransactionHandlers,
  registerBudgetHandlers,
  registerGoalHandlers,
  registerDebtHandlers,
  registerGroupHandlers,
  registerGroupExpenseHandlers,
  registerGroupRepaymentHandlers,
  registerOverviewHandlers,
  registerReportHandlers,
]
