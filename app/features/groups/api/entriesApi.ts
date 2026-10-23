import type { ApiClient } from '~/shared/api/client'
import type { GroupExpenseDto, GroupExpenseInput, Page } from '~/shared/api/contract'
import { type GroupScope, scopePath } from '../utils/scope'

export const ENTRIES_PAGE_SIZE = 100

const expensesPath = (scope: GroupScope) => `${scopePath(scope)}/expenses`

const expensePath = (scope: GroupScope, id: string) => `${expensesPath(scope)}/${encodeURIComponent(id)}`

export const entriesApi = (api: ApiClient, scope: GroupScope) => ({
  expenses: (deleted: boolean, page: number) =>
    api.get<Page<GroupExpenseDto>>(expensesPath(scope), { deleted, page, pageSize: ENTRIES_PAGE_SIZE }),
  createExpense: (body: GroupExpenseInput) => api.post<GroupExpenseDto>(expensesPath(scope), body),
  updateExpense: (id: string, body: GroupExpenseInput) => api.put<GroupExpenseDto>(expensePath(scope, id), body),
  deleteExpense: (id: string) => api.delete(expensePath(scope, id)),
})
