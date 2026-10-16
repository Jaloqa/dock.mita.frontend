import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { UserDto } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { userKeys } from '~/shared/user/keys'
import { settingsApi } from '../api/settingsApi'

export function useProfileUpdate() {
  const api = settingsApi(useApi())
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: async (user: UserDto) => {
      queryClient.setQueryData(userKeys.me, user)
      await invalidateAfter(queryClient, 'profile')
    },
  })
}
