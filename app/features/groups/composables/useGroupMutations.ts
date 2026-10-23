import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { GroupNameInput, GroupUpdateInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { isApiError } from '~/shared/api/problem'
import { groupsApi } from '../api/groupsApi'
import { groupKeys } from '../api/keys'
import { type GroupScope, ownerScope } from '../utils/scope'

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
    remove: useMutation({
      mutationFn: api.remove,
      onSuccess: (_, id) => {
        queryClient.removeQueries({ queryKey: groupKeys.scoped(ownerScope(id)) })
        return queryClient.invalidateQueries({ queryKey: groupKeys.list })
      },
    }),
    share: useMutation({ mutationFn: api.share, onSuccess }),
    unshare: useMutation({ mutationFn: api.unshare, onSuccess }),
    addMember: useMutation({
      mutationFn: ({ id, input }: { id: string; input: GroupNameInput }) => api.addMember(id, input),
      onSuccess,
    }),
    renameMember: useMutation({
      mutationFn: ({ id, memberId, input }: { id: string; memberId: string; input: GroupNameInput }) =>
        api.renameMember(id, memberId, input),
      onSuccess,
    }),
    removeMember: useMutation({
      mutationFn: ({ id, memberId }: { id: string; memberId: string }) => api.removeMember(id, memberId),
      onSuccess,
    }),
    addCategory: useMutation({
      mutationFn: ({ scope, input }: { scope: GroupScope; input: GroupNameInput }) => api.addCategory(scope, input),
      onSuccess,
    }),
    isMissing: (error: unknown) => isApiError(error) && error.status === 404,
    refresh: onSuccess,
  }
}
