import type { ApiClient } from '~/shared/api/client'
import type { Page, TagDto, TagInput } from '~/shared/api/contract'

const tagPath = (id: string) => `/v1/tags/${encodeURIComponent(id)}`

export const tagsApi = (api: ApiClient) => ({
  list: (query: { search?: string; page: number; pageSize: number }) => api.get<Page<TagDto>>('/v1/tags', query),
  rename: (id: string, body: TagInput) => api.put<TagDto>(tagPath(id), body),
  remove: (id: string) => api.delete(tagPath(id)),
})
