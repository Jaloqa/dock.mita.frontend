import type { ApiClient } from '~/shared/api/client'
import type { BudgetCopyInput, BudgetCopyResult, BudgetDto, BudgetInput, BudgetPage } from '~/shared/api/contract'

const budgetPath = (id: string) => `/v1/budgets/${encodeURIComponent(id)}`

export const budgetsApi = (api: ApiClient) => ({
  list: (period: string) => api.get<BudgetPage>('/v1/budgets', { period, pageSize: 100 }),
  create: (body: BudgetInput) => api.post<BudgetDto>('/v1/budgets', body),
  update: (id: string, body: BudgetInput) => api.put<BudgetDto>(budgetPath(id), body),
  remove: (id: string) => api.delete(budgetPath(id)),
  copy: (body: BudgetCopyInput) => api.post<BudgetCopyResult>('/v1/budgets/copy', body),
})
