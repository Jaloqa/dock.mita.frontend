import type { ApiClient } from '~/shared/api/client'
import type { OverviewDto, OverviewRange } from '~/shared/api/contract'

export const overviewApi = (api: ApiClient) => ({
  get: (range: OverviewRange) => api.get<OverviewDto>('/v1/overview', { period: range }),
})
