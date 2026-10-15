import type { ApiClient } from '~/shared/api/client'
import type { AccountDto, AccountInput, Page } from '~/shared/api/contract'

const accountPath = (id: string) => `/v1/accounts/${encodeURIComponent(id)}`

export const accountsApi = (api: ApiClient) => ({
  list: () => api.get<Page<AccountDto>>('/v1/accounts', { pageSize: 100 }),
  create: (body: AccountInput) => api.post<AccountDto>('/v1/accounts', body),
  update: (id: string, body: AccountInput) => api.put<AccountDto>(accountPath(id), body),
  remove: (id: string) => api.delete(accountPath(id)),
})
