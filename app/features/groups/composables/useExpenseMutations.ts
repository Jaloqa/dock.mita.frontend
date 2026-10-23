import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { GroupExpenseInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { isApiError } from '~/shared/api/problem'
import { entriesApi } from '../api/entriesApi'

export function useExpenseMutations() {
  const client = useApi()
  const scope = useGroupScope()
  const queryClient = useQueryClient()
  const api = () => entriesApi(client, scope.value)
  const onSuccess = () => invalidateAfter(queryClient, 'groups')

  return {
    create: useMutation({ mutationFn: (input: GroupExpenseInput) => api().createExpense(input), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: GroupExpenseInput }) => api().updateExpense(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => api().deleteExpense(id), onSuccess }),
    isMissing: (error: unknown) => isApiError(error) && error.status === 404,
    refresh: onSuccess,
  }
}
