import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { GroupUpdateInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { groupsApi } from '../api/groupsApi'

export function useGroupMutations() {
  const api = groupsApi(useApi())
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfter(queryClient, 'groups')

  return {
    create: useMutation({ mutationFn: api.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: GroupUpdateInput }) => api.update(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: api.remove, onSuccess }),
  }
}
