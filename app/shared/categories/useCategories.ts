import { useQuery } from '@tanstack/vue-query'
import type { CategoryKind } from '~/shared/api/contract'
import { categoriesApi } from './categoriesApi'
import { categoryKeys } from './keys'
import { categoriesOfKind, pickableCategories } from './select'

export function useCategories() {
  const api = categoriesApi(useApi())
  const query = useQuery({ queryKey: categoryKeys.list, queryFn: api.list })
  const categories = computed(() => query.data.value?.items ?? [])
  const byId = computed(() => new Map(categories.value.map((category) => [category.id, category])))

  return {
    categories,
    byId,
    ofKind: (kind: CategoryKind) => categoriesOfKind(categories.value, kind),
    pickable: (kind: CategoryKind) => pickableCategories(categories.value, kind),
    nameOf: (id: string) => byId.value.get(id)?.name,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
