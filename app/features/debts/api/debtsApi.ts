import type { ApiClient } from '~/shared/api/client'
import type {
  DebtDto,
  DebtInput,
  DebtPage,
  DebtRepaymentDto,
  DebtRepaymentInput,
  DebtStatus,
  Page,
} from '~/shared/api/contract'

const debtPath = (id: string) => `/v1/debts/${encodeURIComponent(id)}`
const repaymentsPath = (id: string) => `${debtPath(id)}/repayments`

export const debtsApi = (api: ApiClient) => ({
  list: (status: DebtStatus) => api.get<DebtPage>('/v1/debts', { status, pageSize: 100 }),
  create: (body: DebtInput) => api.post<DebtDto>('/v1/debts', body),
  update: (id: string, body: DebtInput) => api.put<DebtDto>(debtPath(id), body),
  remove: (id: string) => api.delete(debtPath(id)),
  repayments: (id: string) => api.get<Page<DebtRepaymentDto>>(repaymentsPath(id), { pageSize: 100 }),
  repay: (id: string, body: DebtRepaymentInput) => api.post<DebtDto>(repaymentsPath(id), body),
  removeRepayment: (id: string, repaymentId: string) =>
    api.delete(`${repaymentsPath(id)}/${encodeURIComponent(repaymentId)}`),
})
