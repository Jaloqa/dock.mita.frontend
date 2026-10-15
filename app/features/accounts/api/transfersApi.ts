import type { ApiClient } from '~/shared/api/client'
import type { Page, TransferDto, TransferInput } from '~/shared/api/contract'

export const transfersApi = (api: ApiClient) => ({
  list: (query: { page: number; pageSize: number; accountId?: string }) =>
    api.get<Page<TransferDto>>('/v1/transfers', query),
  create: (body: TransferInput) => api.post<TransferDto>('/v1/transfers', body),
})
