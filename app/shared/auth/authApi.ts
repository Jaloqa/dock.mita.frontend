import type { ApiClient } from '~/shared/api/client'
import type { DeleteAccountRequest, LoginRequest, RegisterRequest, UserDto } from '~/shared/api/contract'

export const authApi = (api: ApiClient) => ({
  register: (body: RegisterRequest) => api.post<UserDto>('/v1/auth/register', body),
  login: (body: LoginRequest) => api.post<UserDto>('/v1/auth/login', body),
  logout: () => api.post<void>('/v1/auth/logout'),
  deleteAccount: (password: string) => api.delete('/v1/me', { password } satisfies DeleteAccountRequest),
})
