import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { accountsApi } from '~/shared/accounts/accountsApi'
import type { AccountInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'

export function useAccountMutations() {
  const api = accountsApi(useApi())
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfter(queryClient, 'accounts')

  return {
    create: useMutation({ mutationFn: api.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: AccountInput }) => api.update(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: api.remove, onSuccess }),
  }
}
