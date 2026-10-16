import type { ApiClient } from '~/shared/api/client'
import type { ReportDto, ReportRange } from '~/shared/api/contract'

export const reportsApi = (api: ApiClient) => ({
  get: (range: ReportRange) => api.get<ReportDto>('/v1/reports', { range }),
})
