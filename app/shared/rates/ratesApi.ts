import type { ApiClient } from '~/shared/api/client'
import type { RateDto } from '~/shared/api/contract'
import type { Currency } from '~/shared/money/money'

export const RATES_PATH = '/v1/rates'

export const ratesApi = (api: ApiClient) => ({
  list: (query: { to?: Currency; from?: Currency; date?: string }, path = RATES_PATH) =>
    api.get<RateDto[]>(path, query),
})
