import type { GroupInviteDto } from '../../app/shared/api/contract'
import type { GroupMemberRow, GroupRow, MockState } from '../db'
import { badRequest, notFound, unauthorized } from '../errors'
import {
  GROUP_PAGE,
  type GroupScope,
  groupSummary,
  linkedMemberOf,
  memberOf,
  membersOf,
  memberView,
  onLinkGroup,
  openGroup,
  openGroupForWrite,
  ownGroup,
} from '../groups'
import { paginate } from '../paginate'
import type { MockContext, MockRouter } from '../router'
import { collectErrors, isEmailAddress, isMissing, objectBody } from '../validation'

const normalized = (email: string): string => email.trim().toLowerCase()

const emailOf = (state: MockState, userId: string): string =>
  normalized(state.users.find((user) => user.id === userId)?.email ?? '')

function clearInvitation(member: GroupMemberRow): void {
  member.invitedEmail = null
  member.invitedAt = null
}

function link(state: MockState, group: GroupRow, member: GroupMemberRow, userId: string): void {
  if (member.userId !== null && member.userId !== userId) badRequest({ memberId: ['validation.memberLinked'] })
  const own = linkedMemberOf(state, group.id, userId)
  if (own && own.id !== member.id) badRequest({ memberId: ['validation.alreadyLinked'] })
  member.userId = userId
  clearInvitation(member)
}

function validateInvite(body: unknown): string {
  const { email } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(email)) errors.add('email', 'validation.required')
  else if (typeof email !== 'string' || !isEmailAddress(email.trim())) errors.add('email', 'validation.invalidEmail')
  errors.throwIfAny()
  return normalized(email as string)
}

function invitation(state: MockState, userId: string, memberId: string | undefined) {
  const email = emailOf(state, userId)
  const member = state.groupMembers.find(
    (row) => row.id === memberId && row.userId === null && row.invitedEmail === email,
  )
  const group = state.groups.find((row) => row.id === member?.groupId)
  if (!member || !group) return notFound()
  return { group, member }
}

function invitesOf(state: MockState, userId: string): GroupInviteDto[] {
  const email = emailOf(state, userId)
  return state.groupMembers
    .filter((member) => member.userId === null && member.invitedEmail === email && member.invitedAt !== null)
    .flatMap((member) => {
      const group = state.groups.find((row) => row.id === member.groupId)
      if (!group || linkedMemberOf(state, group.id, userId)) return []
      const owner = state.users.find((user) => user.id === group.userId)
      return [
        {
          memberId: member.id,
          groupId: group.id,
          groupName: group.name,
          memberName: member.name,
          ownerName: owner?.name ?? '',
          invitedAt: member.invitedAt ?? '',
        },
      ]
    })
    .sort((a, b) => b.invitedAt.localeCompare(a.invitedAt) || b.memberId.localeCompare(a.memberId))
}

function linkThroughShare({ db, userId }: MockContext, scope: GroupScope) {
  if (!db.state.users.some((user) => user.id === userId)) unauthorized('auth.sessionExpired')
  const { group, actor } = openGroupForWrite(db.state, scope)
  const member = memberOf(db.state, group, actor.actorMemberId ?? undefined)
  link(db.state, group, member, userId)
  db.save()
  return groupSummary(db.state, group, userId)
}

export function registerGroupLinkHandlers(router: MockRouter) {
  router.on('PUT', '/v1/groups/:id/members/:memberId/link', ({ db, userId, params }) => {
    const group = ownGroup(db.state, userId, params.id)
    const member = memberOf(db.state, group, params.memberId)
    link(db.state, group, member, userId)
    db.save()
    return memberView(db.state, member, true)
  })

  router.on('DELETE', '/v1/groups/:id/members/:memberId/link', ({ db, userId, params }) => {
    const group = ownGroup(db.state, userId, params.id)
    memberOf(db.state, group, params.memberId).userId = null
    db.save()
  })

  router.on('PUT', '/v1/groups/:id/members/:memberId/invite', ({ db, userId, params, body }) => {
    const email = validateInvite(body)
    const group = ownGroup(db.state, userId, params.id)
    const member = memberOf(db.state, group, params.memberId)
    const errors = collectErrors()
    if (member.userId !== null) errors.add('memberId', 'validation.memberLinked')
    if (email === emailOf(db.state, userId)) errors.add('email', 'validation.inviteSelf')
    else if (membersOf(db.state, group.id).some((row) => row.id !== member.id && row.invitedEmail === email)) {
      errors.add('email', 'validation.alreadyInvited')
    }
    errors.throwIfAny()
    member.invitedEmail = email
    member.invitedAt = new Date().toISOString()
    db.save()
    return memberView(db.state, member, true)
  })

  router.on('DELETE', '/v1/groups/:id/members/:memberId/invite', ({ db, userId, params }) => {
    const group = ownGroup(db.state, userId, params.id)
    clearInvitation(memberOf(db.state, group, params.memberId))
    db.save()
  })

  router.on('DELETE', '/v1/groups/:id/membership', ({ db, userId, params }) => {
    const group = openGroup(db.state, { kind: 'user', userId, groupId: params.id })
    const member = linkedMemberOf(db.state, group.id, userId) ?? notFound()
    member.userId = null
    db.save()
  })

  router.on('GET', '/v1/group-invites', ({ db, userId, query }) =>
    paginate(invitesOf(db.state, userId), query, GROUP_PAGE),
  )

  router.on('POST', '/v1/group-invites/:memberId/accept', ({ db, userId, params }) => {
    const { group, member } = invitation(db.state, userId, params.memberId)
    link(db.state, group, member, userId)
    db.save()
    return groupSummary(db.state, group, userId)
  })

  router.on('POST', '/v1/group-invites/:memberId/decline', ({ db, userId, params }) => {
    clearInvitation(invitation(db.state, userId, params.memberId).member)
    db.save()
  })

  onLinkGroup(router, 'PUT', '/membership', linkThroughShare)
}
