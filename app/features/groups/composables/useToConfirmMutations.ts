import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { ToConfirmInput, ToConfirmItemDto } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { toConfirmApi } from '../api/toConfirmApi'

export function useToConfirmMutations() {
  const api = toConfirmApi(useApi())
  const queryClient = useQueryClient()

  return {
    confirm: useMutation({
      mutationFn: ({ item, input }: { item: ToConfirmItemDto; input: ToConfirmInput }) =>
        api.confirm(item.kind, item.entryId, input),
      onSuccess: () => invalidateAfter(queryClient, 'groupRecords'),
    }),
    reject: useMutation({
      mutationFn: (item: ToConfirmItemDto) => api.reject(item.kind, item.entryId, item.version),
      onSuccess: () => invalidateAfter(queryClient, 'groups'),
    }),
    refresh: () => invalidateAfter(queryClient, 'groups'),
  }
}
