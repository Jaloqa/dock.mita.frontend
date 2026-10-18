import { useQueryClient } from '@tanstack/vue-query'
import type { LoginRequest, RegisterRequest, UserDto } from '~/shared/api/contract'
import { userKeys } from '~/shared/user/keys'
import { useCurrentUser } from '~/shared/user/useCurrentUser'
import { authApi } from './authApi'
import { useSessionStatus } from './sessionStatus'

export function useSession() {
  const api = authApi(useApi())
  const queryClient = useQueryClient()
  const status = useSessionStatus()
  const localePath = useLocalePath()
  const { user } = useCurrentUser()

  const start = (signedIn: UserDto): UserDto => {
    queryClient.clear()
    queryClient.setQueryData(userKeys.me, signedIn)
    status.value = 'authenticated'
    return signedIn
  }

  return {
    user,
    status: computed(() => status.value),
    login: async (body: LoginRequest) => start(await api.login(body)),
    register: async (body: RegisterRequest) => start(await api.register(body)),
    logout: async () => {
      try {
        await api.logout()
      } finally {
        status.value = 'anonymous'
        queryClient.clear()
        await navigateTo(localePath('login'))
      }
    },
  }
}
