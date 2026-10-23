import type { ApiClient } from '~/shared/api/client'
import type { GroupDto, GroupInput, GroupSummaryDto, GroupUpdateInput, Page } from '~/shared/api/contract'
import { type GroupScope, ownerScope, scopePath } from '../utils/scope'

const groupPath = (id: string) => scopePath(ownerScope(id))

export const groupsApi = (api: ApiClient) => ({
  list: () => api.get<Page<GroupSummaryDto>>('/v1/groups', { pageSize: 100 }),
  create: (body: GroupInput) => api.post<GroupDto>('/v1/groups', body),
  get: (scope: GroupScope) => api.get<GroupDto>(scopePath(scope)),
  update: (id: string, body: GroupUpdateInput) => api.put<GroupDto>(groupPath(id), body),
  remove: (id: string) => api.delete(groupPath(id)),
})
