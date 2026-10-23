import type { ApiClient } from '~/shared/api/client'
import type { DebtDto, DebtInput, DebtPage, DebtStatus } from '~/shared/api/contract'

const debtPath = (id: string) => `/v1/debts/${encodeURIComponent(id)}`

export const debtsApi = (api: ApiClient) => ({
  list: (status: DebtStatus) => api.get<DebtPage>('/v1/debts', { status, pageSize: 100 }),
  create: (body: DebtInput) => api.post<DebtDto>('/v1/debts', body),
  update: (id: string, body: DebtInput) => api.put<DebtDto>(debtPath(id), body),
  remove: (id: string) => api.delete(debtPath(id)),
})
