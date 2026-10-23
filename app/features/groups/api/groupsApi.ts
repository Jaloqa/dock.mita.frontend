import type { ApiClient } from '~/shared/api/client'
import type {
  GroupCategoryDto,
  GroupDto,
  GroupInput,
  GroupMemberDto,
  GroupNameInput,
  GroupSummaryDto,
  GroupUpdateInput,
  Page,
} from '~/shared/api/contract'
import { type GroupScope, ownerScope, scopePath } from '../utils/scope'

const groupPath = (id: string) => scopePath(ownerScope(id))

const sharePath = (id: string) => `${groupPath(id)}/share`

const membersPath = (id: string) => `${groupPath(id)}/members`

const memberPath = (id: string, memberId: string) => `${membersPath(id)}/${encodeURIComponent(memberId)}`

export const groupsApi = (api: ApiClient) => ({
  list: () => api.get<Page<GroupSummaryDto>>('/v1/groups', { pageSize: 100 }),
  create: (body: GroupInput) => api.post<GroupDto>('/v1/groups', body),
  get: (scope: GroupScope) => api.get<GroupDto>(scopePath(scope)),
  update: (id: string, body: GroupUpdateInput) => api.put<GroupDto>(groupPath(id), body),
  remove: (id: string) => api.delete(groupPath(id)),
  share: (id: string) => api.post<GroupDto>(sharePath(id)),
  unshare: (id: string) => api.delete(sharePath(id)),
  addMember: (id: string, body: GroupNameInput) => api.post<GroupMemberDto>(membersPath(id), body),
  renameMember: (id: string, memberId: string, body: GroupNameInput) =>
    api.put<GroupMemberDto>(memberPath(id, memberId), body),
  removeMember: (id: string, memberId: string) => api.delete(memberPath(id, memberId)),
  addCategory: (scope: GroupScope, body: GroupNameInput) =>
    api.post<GroupCategoryDto>(`${scopePath(scope)}/categories`, body),
})
