import type { ApiClient } from '~/shared/api/client'
import type { SettingsDto, UserDto } from '~/shared/api/contract'

export const userApi = (api: ApiClient) => ({
  me: () => api.get<UserDto>('/v1/me'),
  settings: () => api.get<SettingsDto>('/v1/settings'),
  updateSettings: (body: SettingsDto) => api.put<SettingsDto>('/v1/settings', body),
})
