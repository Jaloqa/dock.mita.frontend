import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { GroupDto, GroupInviteInput, GroupNameInput, GroupUpdateInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { isApiError } from '~/shared/api/problem'
import { groupsApi } from '../api/groupsApi'
import { groupKeys } from '../api/keys'
import { type GroupScope, userScope } from '../utils/scope'

export function useGroupMutations() {
  const api = groupsApi(useApi())
  const queryClient = useQueryClient()
  const onMemberRefused = useMemberRefusal()
  const onSuccess = () => invalidateAfter(queryClient, 'groups')
  const groupKey = (id: string) => groupKeys.group(userScope(id))

  return {
    create: useMutation({ mutationFn: api.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: GroupUpdateInput }) => api.update(id, input),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: api.remove,
      onSuccess: (_, id) => {
        queryClient.removeQueries({ queryKey: groupKeys.scoped(userScope(id)) })
        return queryClient.invalidateQueries({ queryKey: groupKeys.list })
      },
    }),
    share: useMutation({
      mutationFn: api.share,
      onSuccess: (group, id) => {
        queryClient.setQueryData(groupKey(id), group)
        return onSuccess()
      },
    }),
    unshare: useMutation({
      mutationFn: api.unshare,
      onSuccess: (_, id) => {
        queryClient.setQueryData<GroupDto>(groupKey(id), (group) => group && { ...group, shareToken: null })
        return onSuccess()
      },
    }),
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
    linkMe: useMutation({
      mutationFn: ({ id, memberId }: { id: string; memberId: string }) => api.linkMe(id, memberId),
      onSuccess,
    }),
    unlinkMember: useMutation({
      mutationFn: ({ id, memberId }: { id: string; memberId: string }) => api.unlinkMember(id, memberId),
      onSuccess,
    }),
    invite: useMutation({
      mutationFn: ({ id, memberId, input }: { id: string; memberId: string; input: GroupInviteInput }) =>
        api.invite(id, memberId, input),
      onSuccess,
    }),
    cancelInvite: useMutation({
      mutationFn: ({ id, memberId }: { id: string; memberId: string }) => api.cancelInvite(id, memberId),
      onSuccess,
    }),
    addCategory: useMutation({
      mutationFn: ({ scope, input }: { scope: GroupScope; input: GroupNameInput }) => api.addCategory(scope, input),
      onSuccess,
      onError: onMemberRefused,
    }),
    isMissing: (error: unknown) => isApiError(error) && error.status === 404,
    refresh: onSuccess,
  }
}
