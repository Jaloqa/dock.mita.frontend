import type { ApiClient } from '~/shared/api/client'
import type { CategoryDto, CategoryInput, Page } from '~/shared/api/contract'

const categoryPath = (id: string) => `/v1/categories/${encodeURIComponent(id)}`

export const categoriesApi = (api: ApiClient) => ({
  list: () => api.get<Page<CategoryDto>>('/v1/categories', { pageSize: 100 }),
  create: (body: CategoryInput) => api.post<CategoryDto>('/v1/categories', body),
  update: (id: string, body: CategoryInput) => api.put<CategoryDto>(categoryPath(id), body),
  remove: (id: string) => api.delete(categoryPath(id)),
})
