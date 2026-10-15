import type { ApiClient } from '~/shared/api/client'
import type { RateDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'

export const ratesApi = (api: ApiClient) => ({
  list: (query: { to?: Currency; from?: Currency; date?: string }) => api.get<RateDto[]>('/v1/rates', query),
})
