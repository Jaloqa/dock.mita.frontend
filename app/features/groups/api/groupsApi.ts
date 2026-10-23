import type { ApiClient } from '~/shared/api/client'
import type {
  GroupCategoryDto,
  GroupDto,
  GroupInput,
  GroupInviteDto,
  GroupInviteInput,
  GroupMemberDto,
  GroupNameInput,
  GroupSummaryDto,
  GroupUpdateInput,
  Page,
} from '~/shared/api/contract'
import { type GroupScope, linkScope, memberHeaders, scopePath, userScope } from '../utils/scope'

const groupPath = (id: string) => scopePath(userScope(id))

const sharePath = (id: string) => `${groupPath(id)}/share`

const membersPath = (id: string) => `${groupPath(id)}/members`

const memberPath = (id: string, memberId: string) => `${membersPath(id)}/${encodeURIComponent(memberId)}`

const linkPath = (id: string, memberId: string) => `${memberPath(id, memberId)}/link`

const invitePath = (id: string, memberId: string) => `${memberPath(id, memberId)}/invite`

const membershipPath = (id: string) => `${groupPath(id)}/membership`

const receivedInvitePath = (memberId: string) => `/v1/group-invites/${encodeURIComponent(memberId)}`

export const groupsApi = (api: ApiClient) => ({
  list: () => api.get<Page<GroupSummaryDto>>('/v1/groups', { pageSize: 100 }),
  create: (body: GroupInput) => api.post<GroupDto>('/v1/groups', body),
  get: (scope: GroupScope) => api.get<GroupDto>(scopePath(scope)),
  update: (id: string, body: GroupUpdateInput) => api.put<GroupDto>(groupPath(id), body),
  remove: (id: string) => api.delete(groupPath(id)),
  leave: (id: string) => api.delete(membershipPath(id)),
  invites: () => api.get<Page<GroupInviteDto>>('/v1/group-invites', { pageSize: 100 }),
  acceptInvite: (memberId: string) => api.post<GroupSummaryDto>(`${receivedInvitePath(memberId)}/accept`),
  declineInvite: (memberId: string) => api.post(`${receivedInvitePath(memberId)}/decline`),
  share: (id: string) => api.post<GroupDto>(sharePath(id)),
  unshare: (id: string) => api.delete(sharePath(id)),
  addMember: (id: string, body: GroupNameInput) => api.post<GroupMemberDto>(membersPath(id), body),
  renameMember: (id: string, memberId: string, body: GroupNameInput) =>
    api.put<GroupMemberDto>(memberPath(id, memberId), body),
  removeMember: (id: string, memberId: string) => api.delete(memberPath(id, memberId)),
  linkMe: (id: string, memberId: string) => api.put<GroupMemberDto>(linkPath(id, memberId)),
  unlinkMember: (id: string, memberId: string) => api.delete(linkPath(id, memberId)),
  invite: (id: string, memberId: string, body: GroupInviteInput) =>
    api.put<GroupMemberDto>(invitePath(id, memberId), body),
  cancelInvite: (id: string, memberId: string) => api.delete(invitePath(id, memberId)),
  linkThroughShare: (token: string, memberId: string) => {
    const scope = linkScope(token, memberId)
    return api.put<GroupSummaryDto>(`${scopePath(scope)}/membership`, undefined, { headers: memberHeaders(scope) })
  },
  addCategory: (scope: GroupScope, body: GroupNameInput) =>
    api.post<GroupCategoryDto>(`${scopePath(scope)}/categories`, body, { headers: memberHeaders(scope) }),
})
