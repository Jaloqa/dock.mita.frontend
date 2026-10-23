import type { ApiClient } from '~/shared/api/client'
import type {
  GroupBalancesDto,
  GroupEntryEvent,
  GroupExpenseDto,
  GroupExpenseInput,
  GroupExpenseState,
  GroupRepaymentDto,
  GroupRepaymentInput,
  GroupRepaymentState,
  Page,
} from '~/shared/api/contract'
import type { Currency } from '~/shared/money/currencies'
import { type GroupScope, memberHeaders, scopePath } from '../utils/scope'

export const ENTRIES_PAGE_SIZE = 100

const expensesPath = (scope: GroupScope) => `${scopePath(scope)}/expenses`

const expensePath = (scope: GroupScope, id: string) => `${expensesPath(scope)}/${encodeURIComponent(id)}`

const repaymentsPath = (scope: GroupScope) => `${scopePath(scope)}/repayments`

const repaymentPath = (scope: GroupScope, id: string) => `${repaymentsPath(scope)}/${encodeURIComponent(id)}`

export const entriesApi = (api: ApiClient, scope: GroupScope) => {
  const write = { headers: memberHeaders(scope) }

  return {
    expenses: (deleted: boolean, page: number) =>
      api.get<Page<GroupExpenseDto>>(expensesPath(scope), { deleted, page, pageSize: ENTRIES_PAGE_SIZE }),
    createExpense: (body: GroupExpenseInput) => api.post<GroupExpenseDto>(expensesPath(scope), body, write),
    updateExpense: (id: string, body: GroupExpenseInput) =>
      api.put<GroupExpenseDto>(expensePath(scope, id), body, write),
    deleteExpense: (id: string) => api.delete(expensePath(scope, id), undefined, write),
    restoreExpense: (id: string) => api.post<GroupExpenseDto>(`${expensePath(scope, id)}/restore`, undefined, write),
    expenseHistory: (id: string, page: number) =>
      api.get<Page<GroupEntryEvent<GroupExpenseState>>>(`${expensePath(scope, id)}/history`, {
        page,
        pageSize: ENTRIES_PAGE_SIZE,
      }),
    repayments: (deleted: boolean, page: number) =>
      api.get<Page<GroupRepaymentDto>>(repaymentsPath(scope), { deleted, page, pageSize: ENTRIES_PAGE_SIZE }),
    createRepayment: (body: GroupRepaymentInput) => api.post<GroupRepaymentDto>(repaymentsPath(scope), body, write),
    updateRepayment: (id: string, body: GroupRepaymentInput) =>
      api.put<GroupRepaymentDto>(repaymentPath(scope, id), body, write),
    deleteRepayment: (id: string) => api.delete(repaymentPath(scope, id), undefined, write),
    restoreRepayment: (id: string) =>
      api.post<GroupRepaymentDto>(`${repaymentPath(scope, id)}/restore`, undefined, write),
    repaymentHistory: (id: string, page: number) =>
      api.get<Page<GroupEntryEvent<GroupRepaymentState>>>(`${repaymentPath(scope, id)}/history`, {
        page,
        pageSize: ENTRIES_PAGE_SIZE,
      }),
    balances: (currency: Currency) => api.get<GroupBalancesDto>(`${scopePath(scope)}/balances`, { currency }),
  }
}
