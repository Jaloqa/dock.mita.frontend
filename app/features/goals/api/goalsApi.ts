import type { ApiClient } from '~/shared/api/client'
import type { GoalContributionInput, GoalDto, GoalInput, GoalPage } from '~/shared/api/contract'

const goalPath = (id: string) => `/v1/goals/${encodeURIComponent(id)}`

export const goalsApi = (api: ApiClient) => ({
  list: () => api.get<GoalPage>('/v1/goals', { pageSize: 100 }),
  create: (body: GoalInput) => api.post<GoalDto>('/v1/goals', body),
  update: (id: string, body: GoalInput) => api.put<GoalDto>(goalPath(id), body),
  remove: (id: string) => api.delete(goalPath(id)),
  contribute: (id: string, body: GoalContributionInput) => api.post<GoalDto>(`${goalPath(id)}/contributions`, body),
})
