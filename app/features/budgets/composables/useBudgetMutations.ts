import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { BudgetInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { budgetsApi } from '../api/budgetsApi'

export function useBudgetMutations() {
  const api = budgetsApi(useApi())
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfter(queryClient, 'budgets')

  return {
    create: useMutation({ mutationFn: api.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: BudgetInput }) => api.update(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: api.remove, onSuccess }),
    copy: useMutation({ mutationFn: api.copy, onSettled: onSuccess }),
  }
}
