import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { CategoryInput } from '~/shared/api/contract'
import { invalidateAfter } from '~/shared/api/invalidation'
import { categoriesApi } from '~/shared/categories/categoriesApi'

export function useCategoryMutations() {
  const api = categoriesApi(useApi())
  const queryClient = useQueryClient()
  const onSuccess = () => invalidateAfter(queryClient, 'categories')

  return {
    create: useMutation({ mutationFn: api.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: CategoryInput }) => api.update(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: api.remove, onSuccess }),
  }
}
