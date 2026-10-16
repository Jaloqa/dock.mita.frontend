import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { GoalContributionInput, GoalInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { goalsApi } from '../api/goalsApi'

export function useGoalMutations() {
  const api = goalsApi(useApi())
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfter(queryClient, 'goals')

  return {
    create: useMutation({ mutationFn: api.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: GoalInput }) => api.update(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: api.remove, onSuccess }),
    contribute: useMutation({
      mutationFn: ({ id, input }: { id: string; input: GoalContributionInput }) => api.contribute(id, input),
      onSuccess: () => invalidateAfter(queryClient, 'goalContributions'),
    }),
  }
}
