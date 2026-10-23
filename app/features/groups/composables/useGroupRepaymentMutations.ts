import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { GroupRepaymentInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { isApiError } from '~/shared/api/problem'
import { entriesApi } from '../api/entriesApi'

export function useGroupRepaymentMutations() {
  const client = useApi()
  const scope = useGroupScope()
  const queryClient = useQueryClient()
  const api = () => entriesApi(client, scope.value)
  const onSuccess = () => invalidateAfter(queryClient, 'groups')

  return {
    create: useMutation({ mutationFn: (input: GroupRepaymentInput) => api().createRepayment(input), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: GroupRepaymentInput }) => api().updateRepayment(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => api().deleteRepayment(id), onSuccess }),
    isMissing: (error: unknown) => isApiError(error) && error.status === 404,
    refresh: onSuccess,
  }
}
