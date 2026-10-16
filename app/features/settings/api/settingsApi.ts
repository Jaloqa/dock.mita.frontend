import type { ApiClient } from '~/shared/api/client'
import type { DemoStateDto, UpdateMeRequest, UserDto } from '~/shared/api/contract'

export const settingsApi = (api: ApiClient) => ({
  updateMe: (body: UpdateMeRequest) => api.put<UserDto>('/v1/me', body),
  demoState: () => api.get<DemoStateDto>('/v1/demo/state'),
  switchUser: (userId: string) => api.post<DemoStateDto>('/v1/demo/switch-user', { userId }),
  resetDemo: () => api.post<DemoStateDto>('/v1/demo/reset'),
  simulateErrors: (enabled: boolean) => api.put<DemoStateDto>('/v1/demo/simulate-errors', { enabled }),
})
