import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { TagInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { isApiError } from '~/shared/api/problem'
import { tagsApi } from '../api/tagsApi'

export function useTagMutations() {
  const api = tagsApi(useApi())
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfter(queryClient, 'tags')

  return {
    rename: useMutation({
      mutationFn: ({ id, input }: { id: string; input: TagInput }) => api.rename(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: api.remove, onSuccess }),
    isMissing: (error: unknown) => isApiError(error) && error.status === 404,
    refresh: onSuccess,
  }
}
