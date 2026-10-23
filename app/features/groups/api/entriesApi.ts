import type { ApiClient } from '~/shared/api/client'
import type {
  GroupBalancesDto,
  GroupExpenseDto,
  GroupExpenseInput,
  GroupRepaymentDto,
  GroupRepaymentInput,
  Page,
} from '~/shared/api/contract'
import type { Currency } from '~/shared/money/currencies'
import { type GroupScope, scopePath } from '../utils/scope'

export const ENTRIES_PAGE_SIZE = 100

const expensesPath = (scope: GroupScope) => `${scopePath(scope)}/expenses`

const expensePath = (scope: GroupScope, id: string) => `${expensesPath(scope)}/${encodeURIComponent(id)}`

const repaymentsPath = (scope: GroupScope) => `${scopePath(scope)}/repayments`

const repaymentPath = (scope: GroupScope, id: string) => `${repaymentsPath(scope)}/${encodeURIComponent(id)}`

export const entriesApi = (api: ApiClient, scope: GroupScope) => ({
  expenses: (deleted: boolean, page: number) =>
    api.get<Page<GroupExpenseDto>>(expensesPath(scope), { deleted, page, pageSize: ENTRIES_PAGE_SIZE }),
  createExpense: (body: GroupExpenseInput) => api.post<GroupExpenseDto>(expensesPath(scope), body),
  updateExpense: (id: string, body: GroupExpenseInput) => api.put<GroupExpenseDto>(expensePath(scope, id), body),
  deleteExpense: (id: string) => api.delete(expensePath(scope, id)),
  repayments: (deleted: boolean, page: number) =>
    api.get<Page<GroupRepaymentDto>>(repaymentsPath(scope), { deleted, page, pageSize: ENTRIES_PAGE_SIZE }),
  createRepayment: (body: GroupRepaymentInput) => api.post<GroupRepaymentDto>(repaymentsPath(scope), body),
  updateRepayment: (id: string, body: GroupRepaymentInput) =>
    api.put<GroupRepaymentDto>(repaymentPath(scope, id), body),
  deleteRepayment: (id: string) => api.delete(repaymentPath(scope, id)),
  balances: (currency: Currency) => api.get<GroupBalancesDto>(`${scopePath(scope)}/balances`, { currency }),
})
