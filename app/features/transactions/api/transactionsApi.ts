import type { ApiClient } from '~/shared/api/client'
import type { TransactionDto, TransactionInput, TransactionPage, TransactionQuery } from '~/shared/api/contract'

const transactionPath = (id: string) => `/v1/transactions/${encodeURIComponent(id)}`

export const transactionsApi = (api: ApiClient) => ({
  list: (query: TransactionQuery & { page: number; pageSize: number }) =>
    api.get<TransactionPage>('/v1/transactions', query),
  get: (id: string) => api.get<TransactionDto>(transactionPath(id)),
  create: (body: TransactionInput) => api.post<TransactionDto>('/v1/transactions', body),
  update: (id: string, body: TransactionInput) => api.put<TransactionDto>(transactionPath(id), body),
  remove: (id: string) => api.delete(transactionPath(id)),
})
