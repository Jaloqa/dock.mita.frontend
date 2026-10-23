import { describe, expect, it } from 'bun:test'
import {
  type DebtPage,
  GROUP_MEMBER_HEADER,
  type GroupActorDto,
  type GroupCategoryDto,
  type GroupDebtDto,
  type GroupDto,
  type GroupEntryEvent,
  type GroupExpenseDto,
  type GroupExpenseState,
  type GroupInviteDto,
  type GroupMemberDto,
  type GroupSummaryDto,
  type OverviewDto,
  type Page,
} from '../../../app/shared/api/contract'
import type { HttpMethod } from '../../../app/shared/api/transport'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import type { MockApi } from '../../../mocks/api'
import { MockHttpError } from '../../../mocks/errors'
import { defaultSettings } from '../../../mocks/seed/users'
import { loggedInMockApi, quoteRate } from './session'

const today = todayIso()
const rateDay = addDaysIso(today, -3)

const ANNA = 'usr_anna'
const OLEH = 'usr_oleh'
const BOHDAN = 'usr_bohdan'
const CLEO = 'usr_cleo'

const ISO_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const MEMBER_KEYS = ['id', 'name', 'inUse', 'linked', 'linkedName', 'invitedEmail']
const INVITE_KEYS = ['memberId', 'groupId', 'groupName', 'memberName', 'ownerName', 'invitedAt']
const SUMMARY_KEYS = ['id', 'name', 'currency', 'members', 'total', 'role']
const DEBT_LINE_KEYS = ['groupId', 'name', 'currency', 'balance']
const DEBT_SUMMARY_KEYS = ['owedToMe', 'owedByMe', 'open', 'overdue', 'groups']

const problemOf = async (promise: Promise<unknown>) => {
  const error = await promise.catch((failure: unknown) => failure)
  expect(error).toBeInstanceOf(MockHttpError)
  return (error as MockHttpError).problem
}

const notFound = async (promise: Promise<unknown>) =>
  expect(await problemOf(promise)).toEqual({ status: 404, title: 'Not Found' })

const memberRequired = async (promise: Promise<unknown>) =>
  expect(await problemOf(promise)).toEqual({ status: 403, title: 'Forbidden', code: 'group.memberRequired' })

const refused = async (promise: Promise<unknown>, errors: Record<string, string[]>) => {
  const problem = await problemOf(promise)
  expect(problem.status).toBe(400)
  expect(problem.errors).toEqual(errors)
}

const unavailable = async (promise: Promise<unknown>) =>
  expect(await problemOf(promise)).toMatchObject({ status: 503, code: 'rates.unavailable' })

type Caller = {
  get: (path: string, query?: Record<string, string>) => Promise<unknown>
  send: (method: HttpMethod, path: string, body?: unknown, headers?: Record<string, string>) => Promise<unknown>
}

const as = (mock: MockApi, userId: string | null): Caller => ({
  get: (path, query) => {
    mock.db.state.activeUserId = userId
    return mock.handle({ method: 'GET', path, query })
  },
  send: (method, path, body, headers) => {
    mock.db.state.activeUserId = userId
    return mock.handle({ method, path, body, headers })
  },
})

const addUser = (mock: MockApi, id: string, name: string, email: string): void => {
  mock.db.state.users.push({ id, name, email, createdAt: '2026-06-01T09:00:00Z' })
  mock.db.state.settings.push(defaultSettings(id, 'en'))
}

const api = (): MockApi => {
  const mock = loggedInMockApi()
  Object.assign(mock.db.state, {
    groups: [],
    groupMembers: [],
    groupCategories: [],
    groupExpenses: [],
    groupRepayments: [],
    groupEvents: [],
    debts: [],
    debtRepayments: [],
  })
  addUser(mock, BOHDAN, 'Bohdan', 'Bohdan@Example.COM')
  addUser(mock, CLEO, 'Cleo', 'cleo@example.com')
  quoteRate(mock, 'EUR', 4.3, rateDay)
  return mock
}

const groupPath = (groupId: string, suffix = '') => `/v1/groups/${groupId}${suffix}`
const memberPath = (groupId: string, memberId: string, suffix = '') =>
  groupPath(groupId, `/members/${memberId}${suffix}`)
const linkPath = (token: string, suffix = '') => `/v1/shared/groups/${token}${suffix}`
const acceptPath = (memberId: string) => `/v1/group-invites/${memberId}/accept`
const declinePath = (memberId: string) => `/v1/group-invites/${memberId}/decline`

const createGroup = (caller: Caller, name = 'Trip', currency = 'EUR', members = ['Anna', 'Olya', 'Max']) =>
  caller.send('POST', '/v1/groups', { name, currency, members }) as Promise<GroupDto>

const trip = async (mock: MockApi, owner = as(mock, ANNA)) => {
  const group = await createGroup(owner)
  const [anna, olya, max] = group.members.map((member) => member.id) as [string, string, string]
  return { group, anna, olya, max }
}

const shared = async (mock: MockApi, owner = as(mock, ANNA)) => {
  const created = await trip(mock, owner)
  const withLink = (await owner.send('POST', groupPath(created.group.id, '/share'))) as GroupDto
  return { ...created, token: withLink.shareToken as string }
}

const memberRow = (mock: MockApi, memberId: string) => {
  const row = mock.db.state.groupMembers.find((member) => member.id === memberId)
  if (!row) throw new Error(`No member ${memberId}`)
  return row
}

const linkDirect = (mock: MockApi, memberId: string, userId: string | null): void => {
  const row = memberRow(mock, memberId)
  row.userId = userId
  row.invitedEmail = null
  row.invitedAt = null
}

const inviteDirect = (mock: MockApi, memberId: string, email: string): void => {
  const row = memberRow(mock, memberId)
  row.invitedEmail = email
  row.invitedAt = new Date().toISOString()
}

const storedLinks = (mock: MockApi, groupId: string) =>
  mock.db.state.groupMembers
    .filter((member) => member.groupId === groupId)
    .sort((a, b) => a.position - b.position)
    .map((member) => member.userId)

const storedInvites = (mock: MockApi, groupId: string) =>
  mock.db.state.groupMembers
    .filter((member) => member.groupId === groupId)
    .sort((a, b) => a.position - b.position)
    .map((member) => member.invitedEmail)

const expenseBody = (payerId: string, amount = 9_000, patch: Record<string, unknown> = {}) => ({
  payerId,
  amount,
  currency: 'EUR',
  date: today,
  ...patch,
})

const membersOf = (group: GroupDto): GroupMemberDto[] => group.members

const getGroup = (caller: Caller, groupId: string) => caller.get(groupPath(groupId)) as Promise<GroupDto>

const invite = (caller: Caller, groupId: string, memberId: string, email: unknown) =>
  caller.send('PUT', memberPath(groupId, memberId, '/invite'), { email }) as Promise<GroupMemberDto>

const actingMember = (memberId: string, name: string): GroupActorDto => ({ kind: 'member', memberId, name })

const owner = (name: string): GroupActorDto => ({ kind: 'owner', memberId: null, name })

describe('linked members of a group', () => {
  it('opens the group for a linked user as their member', async () => {
    const mock = api()
    const { group, olya } = await shared(mock)
    linkDirect(mock, olya, OLEH)

    const read = await getGroup(as(mock, OLEH), group.id)

    expect(read).toMatchObject({ id: group.id, name: 'Trip', role: 'member', myMemberId: olya, shareToken: null })
    expect(membersOf(read).map((member) => member.name)).toEqual(['Anna', 'Olya', 'Max'])
    expect(membersOf(read).map((member) => member.linked)).toEqual([false, true, false])
    expect((await as(mock, OLEH).get(groupPath(group.id, '/balances'))) as object).toMatchObject({
      groupCurrency: 'EUR',
    })
  })

  it('shows the details of a link to the owner only', async () => {
    const mock = api()
    const { group, anna, olya, max, token } = await shared(mock)
    linkDirect(mock, anna, ANNA)
    linkDirect(mock, olya, OLEH)
    inviteDirect(mock, max, 'max@example.com')

    const asOwner = await getGroup(as(mock, ANNA), group.id)
    const asLinked = await getGroup(as(mock, OLEH), group.id)
    const anonymous = (await as(mock, null).get(linkPath(token))) as GroupDto
    const linkedThroughLink = (await as(mock, OLEH).get(linkPath(token))) as GroupDto

    expect(asOwner).toMatchObject({ role: 'owner', myMemberId: anna, shareToken: token })
    expect(membersOf(asOwner).map((member) => member.linked)).toEqual([true, true, false])
    expect(membersOf(asOwner).map((member) => member.linkedName)).toEqual(['Anna Nowak', 'Oleh Kravets', null])
    expect(membersOf(asOwner).map((member) => member.invitedEmail)).toEqual([null, null, 'max@example.com'])

    expect(asLinked).toMatchObject({ role: 'member', myMemberId: olya, shareToken: null })
    expect(membersOf(asLinked).map((member) => member.linked)).toEqual([true, true, false])
    expect(membersOf(asLinked).map((member) => member.linkedName)).toEqual([null, null, null])
    expect(membersOf(asLinked).map((member) => member.invitedEmail)).toEqual([null, null, null])

    expect(anonymous).toMatchObject({ role: 'link', myMemberId: null, shareToken: null })
    expect(membersOf(anonymous).map((member) => member.linked)).toEqual([true, true, false])
    expect(membersOf(anonymous).map((member) => member.linkedName)).toEqual([null, null, null])
    expect(membersOf(anonymous).map((member) => member.invitedEmail)).toEqual([null, null, null])
    expect(linkedThroughLink).toEqual(anonymous)
    const owned = (await as(mock, ANNA).get(linkPath(token))) as GroupDto
    expect(owned).toEqual(anonymous)
  })

  it('records the linked member as the actor and keeps the owner as the owner', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    linkDirect(mock, anna, ANNA)
    linkDirect(mock, olya, OLEH)
    const linked = as(mock, OLEH)
    const body = expenseBody(olya, 9_000, { split: { mode: 'equal', memberIds: [anna, olya, max] } })

    const created = (await linked.send('POST', groupPath(group.id, '/expenses'), body)) as GroupExpenseDto

    expect(created.createdBy).toEqual(actingMember(olya, 'Olya'))
    expect(created.updatedBy).toBeNull()
    const path = groupPath(group.id, `/expenses/${created.id}`)
    const edited = (await linked.send('PUT', path, { ...body, amount: 12_000 })) as GroupExpenseDto
    expect(await linked.send('DELETE', path)).toBeUndefined()
    const restored = (await linked.send('POST', `${path}/restore`)) as GroupExpenseDto
    expect(edited.updatedBy).toEqual(actingMember(olya, 'Olya'))
    expect(restored).toMatchObject({ deleted: false, amount: 12_000, updatedBy: actingMember(olya, 'Olya') })

    const byOwner = (await as(mock, ANNA).send('PUT', path, { ...body, amount: 15_000 })) as GroupExpenseDto
    expect(byOwner.createdBy).toEqual(actingMember(olya, 'Olya'))
    expect(byOwner.updatedBy).toEqual(owner('Anna Nowak'))

    const history = (await linked.get(`${path}/history`)) as Page<GroupEntryEvent<GroupExpenseState>>
    expect(history.items.map((event) => event.action)).toEqual(['updated', 'restored', 'deleted', 'updated', 'created'])
    expect(history.items.map((event) => event.actor)).toEqual([
      owner('Anna Nowak'),
      actingMember(olya, 'Olya'),
      actingMember(olya, 'Olya'),
      actingMember(olya, 'Olya'),
      actingMember(olya, 'Olya'),
    ])
    expect(
      mock.db.state.groupEvents
        .filter((event) => event.entryId === created.id)
        .map((event) => [event.actorUserId, event.actorMemberId]),
    ).toEqual([
      [null, olya],
      [null, olya],
      [null, olya],
      [null, olya],
      [ANNA, null],
    ])
  })

  it('lets a linked user write repayments and categories and read the balances', async () => {
    const mock = api()
    const { group, anna, olya } = await trip(mock)
    linkDirect(mock, olya, OLEH)
    const linked = as(mock, OLEH)

    const repayment = (await linked.send('POST', groupPath(group.id, '/repayments'), {
      fromMemberId: olya,
      toMemberId: anna,
      amount: 2_000,
      currency: 'EUR',
      date: today,
    })) as { createdBy: GroupActorDto }
    const category = (await linked.send('POST', groupPath(group.id, '/categories'), {
      name: 'Ferry',
    })) as GroupCategoryDto
    const balances = (await linked.get(groupPath(group.id, '/balances'))) as { members: { balance: number }[] }

    expect(repayment.createdBy).toEqual(actingMember(olya, 'Olya'))
    expect(category).toMatchObject({ standard: false, name: 'Ferry' })
    expect(balances.members.map((member) => member.balance)).toEqual([-2_000, 2_000, 0])
  })

  it('keeps the owner routes for the owner only', async () => {
    const mock = api()
    const { group, olya, max, token } = await shared(mock)
    linkDirect(mock, olya, OLEH)
    const linked = as(mock, OLEH)
    const refusedRoutes: [HttpMethod, string, unknown][] = [
      ['PUT', groupPath(group.id), { name: 'Hijacked', currency: 'PLN' }],
      ['DELETE', groupPath(group.id), undefined],
      ['POST', groupPath(group.id, '/members'), { name: 'Eve' }],
      ['PUT', memberPath(group.id, olya), { name: 'Eve' }],
      ['DELETE', memberPath(group.id, max), undefined],
      ['POST', groupPath(group.id, '/share'), undefined],
      ['DELETE', groupPath(group.id, '/share'), undefined],
    ]

    for (const [method, path, body] of refusedRoutes) await notFound(linked.send(method, path, body))

    const stored = mock.db.state.groups.find((row) => row.id === group.id)
    expect(stored).toMatchObject({ name: 'Trip', currency: 'EUR', shareToken: token })
    expect(mock.db.state.groupMembers.filter((row) => row.groupId === group.id).map((row) => row.name)).toEqual([
      'Anna',
      'Olya',
      'Max',
    ])
    expect(await linked.send('POST', groupPath(group.id, '/categories'), { name: 'Ferry' })).toMatchObject({
      name: 'Ferry',
    })
  })

  it('lists the groups a user owns and the groups they are linked to', async () => {
    const mock = api()
    const { group: tripGroup, olya } = await trip(mock)
    linkDirect(mock, olya, OLEH)
    const inviterGroup = await createGroup(as(mock, CLEO), 'Invited', 'EUR', ['Ann', 'Bob'])
    inviteDirect(mock, inviterGroup.members[0]?.id as string, 'oleh@demo.mita.app')
    const home = await createGroup(as(mock, OLEH), 'Home', 'PLN', ['Me', 'Flatmate'])

    const linkedList = (await as(mock, OLEH).get('/v1/groups')) as Page<GroupSummaryDto>
    const ownerList = (await as(mock, ANNA).get('/v1/groups')) as Page<GroupSummaryDto>
    const inviterList = (await as(mock, CLEO).get('/v1/groups')) as Page<GroupSummaryDto>

    expect(linkedList.total).toBe(2)
    expect(linkedList.items.map((item) => item.id)).toEqual([home.id, tripGroup.id])
    expect(linkedList.items.map((item) => item.role)).toEqual(['owner', 'member'])
    expect(linkedList.items.map((item) => item.members)).toEqual([2, 3])
    expect(Object.keys(linkedList.items[0] ?? {})).toEqual(SUMMARY_KEYS)
    expect(ownerList.items.map((item) => [item.id, item.role])).toEqual([[tripGroup.id, 'owner']])
    expect(inviterList.items.map((item) => item.id)).toEqual([inviterGroup.id])
  })

  it('answers 404 once the user left or was unlinked', async () => {
    const mock = api()
    const { group, olya } = await trip(mock)
    linkDirect(mock, olya, OLEH)
    const linked = as(mock, OLEH)
    const stranger = as(mock, BOHDAN)
    const expensesPath = groupPath(group.id, '/expenses')
    expect((await getGroup(linked, group.id)).role).toBe('member')

    linkDirect(mock, olya, null)

    await notFound(linked.get(groupPath(group.id)))
    await notFound(linked.get(expensesPath))
    await notFound(linked.send('POST', expensesPath, expenseBody(olya)))
    await notFound(stranger.get(groupPath(group.id)))
    await notFound(stranger.send('POST', expensesPath, expenseBody(olya)))
    expect(((await linked.get('/v1/groups')) as Page<GroupSummaryDto>).total).toBe(0)
    expect(mock.db.state.groupExpenses).toHaveLength(0)
  })
})

describe('member links of the owner', () => {
  it('links the owner to a member and refuses a second member', async () => {
    const mock = api()
    const { group, anna, olya } = await trip(mock)
    const owned = as(mock, ANNA)

    const linked = (await owned.send('PUT', memberPath(group.id, anna, '/link'))) as GroupMemberDto

    expect(Object.keys(linked)).toEqual(MEMBER_KEYS)
    expect(linked).toEqual({
      id: anna,
      name: 'Anna',
      inUse: false,
      linked: true,
      linkedName: 'Anna Nowak',
      invitedEmail: null,
    })
    expect(await owned.send('PUT', memberPath(group.id, anna, '/link'))).toEqual(linked)
    const read = await getGroup(owned, group.id)
    expect(read.myMemberId).toBe(anna)
    expect(membersOf(read)[0]).toEqual(linked)

    await refused(owned.send('PUT', memberPath(group.id, olya, '/link')), { memberId: ['validation.alreadyLinked'] })
    expect(storedLinks(mock, group.id)).toEqual([ANNA, null, null])
  })

  it('refuses to link a member that is linked to someone else, before any other rule', async () => {
    const mock = api()
    const { group, anna, olya } = await trip(mock)
    const owned = as(mock, ANNA)
    linkDirect(mock, olya, OLEH)

    await refused(owned.send('PUT', memberPath(group.id, olya, '/link')), { memberId: ['validation.memberLinked'] })
    expect((await getGroup(owned, group.id)).myMemberId).toBeNull()

    linkDirect(mock, anna, ANNA)

    await refused(owned.send('PUT', memberPath(group.id, olya, '/link')), { memberId: ['validation.memberLinked'] })
    expect(storedLinks(mock, group.id)).toEqual([ANNA, OLEH, null])
  })

  it('unlinks any member, also one that is not linked', async () => {
    const mock = api()
    const { group, anna, olya } = await trip(mock)
    const owned = as(mock, ANNA)
    linkDirect(mock, olya, OLEH)
    expect((await getGroup(as(mock, OLEH), group.id)).role).toBe('member')

    expect(await owned.send('DELETE', memberPath(group.id, olya, '/link'))).toBeUndefined()

    await notFound(as(mock, OLEH).get(groupPath(group.id)))
    expect(storedLinks(mock, group.id)).toEqual([null, null, null])
    expect(membersOf(await getGroup(owned, group.id)).map((member) => member.linked)).toEqual([false, false, false])
    expect(await owned.send('DELETE', memberPath(group.id, olya, '/link'))).toBeUndefined()

    linkDirect(mock, anna, ANNA)
    expect(await owned.send('DELETE', memberPath(group.id, anna, '/link'))).toBeUndefined()
    expect((await getGroup(owned, group.id)).myMemberId).toBeNull()
  })

  it('invites a member by email, replaces the invitation and cancels it', async () => {
    const mock = api()
    const { group, max } = await trip(mock)
    const owned = as(mock, ANNA)
    const before = Date.now()

    const invited = await invite(owned, group.id, max, ' Max@Example.com ')

    expect(Object.keys(invited)).toEqual(MEMBER_KEYS)
    expect(invited).toEqual({
      id: max,
      name: 'Max',
      inUse: false,
      linked: false,
      linkedName: null,
      invitedEmail: 'max@example.com',
    })
    const first = memberRow(mock, max)
    expect(first.invitedEmail).toBe('max@example.com')
    expect(first.invitedAt).toMatch(ISO_MILLISECONDS)
    expect(Date.parse(first.invitedAt as string)).toBeGreaterThanOrEqual(before - 1)
    expect(membersOf(await getGroup(owned, group.id))[2]).toEqual(invited)

    const firstAt = first.invitedAt ?? ''
    expect((await invite(owned, group.id, max, 'm@x.pl')).invitedEmail).toBe('m@x.pl')
    expect((memberRow(mock, max).invitedAt ?? '') >= firstAt).toBe(true)
    expect(membersOf(await getGroup(owned, group.id)).map((member) => member.invitedEmail)).toEqual([
      null,
      null,
      'm@x.pl',
    ])

    expect(await owned.send('DELETE', memberPath(group.id, max, '/invite'))).toBeUndefined()

    expect(membersOf(await getGroup(owned, group.id)).map((member) => member.invitedEmail)).toEqual([null, null, null])
    expect(memberRow(mock, max)).toMatchObject({ invitedEmail: null, invitedAt: null })
    expect(await owned.send('DELETE', memberPath(group.id, max, '/invite'))).toBeUndefined()
  })

  it('refuses the own email, an email another member holds and a linked member', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    const owned = as(mock, ANNA)

    await refused(invite(owned, group.id, anna, ' ANNA@DEMO.MITA.APP '), { email: ['validation.inviteSelf'] })

    await invite(owned, group.id, olya, 'o@x.pl')
    await refused(invite(owned, group.id, max, 'O@X.pl'), { email: ['validation.alreadyInvited'] })
    await invite(owned, group.id, olya, 'O@x.PL')
    expect(storedInvites(mock, group.id)).toEqual([null, 'o@x.pl', null])

    linkDirect(mock, olya, OLEH)
    await refused(invite(owned, group.id, olya, 'new@x.pl'), { memberId: ['validation.memberLinked'] })

    await invite(owned, group.id, max, 'm@x.pl')
    await refused(invite(owned, group.id, olya, 'M@x.pl'), {
      memberId: ['validation.memberLinked'],
      email: ['validation.alreadyInvited'],
    })
    await refused(invite(owned, group.id, olya, 'anna@demo.mita.app'), {
      memberId: ['validation.memberLinked'],
      email: ['validation.inviteSelf'],
    })
    expect(storedLinks(mock, group.id)).toEqual([null, OLEH, null])
    expect(storedInvites(mock, group.id)).toEqual([null, null, 'm@x.pl'])
  })

  it('checks the email of an invitation before the group', async () => {
    const mock = api()
    const { group, anna } = await trip(mock)
    const owned = as(mock, ANNA)
    const path = memberPath(group.id, anna, '/invite')
    const tooLong = `${'a'.repeat(250)}@x.pl`

    await refused(owned.send('PUT', path, {}), { email: ['validation.required'] })
    await refused(owned.send('PUT', path, undefined), { email: ['validation.required'] })
    await refused(owned.send('PUT', path, { email: '   ' }), { email: ['validation.required'] })
    await refused(owned.send('PUT', path, { email: null }), { email: ['validation.required'] })
    for (const email of [42, true, 'no-at-sign', 'a@b', 'a b@c.pl', 'a@@c.pl', tooLong]) {
      await refused(owned.send('PUT', path, { email }), { email: ['validation.invalidEmail'] })
    }
    await refused(owned.send('PUT', memberPath('grp_missing', anna, '/invite'), { email: 'no-at-sign' }), {
      email: ['validation.invalidEmail'],
    })
    await notFound(owned.send('PUT', memberPath('grp_missing', anna, '/invite'), { email: 'eve@example.com' }))
    await notFound(owned.send('PUT', memberPath(group.id, 'mbr_missing', '/invite'), { email: 'eve@example.com' }))
    expect(storedInvites(mock, group.id)).toEqual([null, null, null])
  })

  it('clears the invitation when the member is linked', async () => {
    const mock = api()
    const { group, anna } = await trip(mock)
    const owned = as(mock, ANNA)
    await invite(owned, group.id, anna, 'anna@example.com')

    const linked = (await owned.send('PUT', memberPath(group.id, anna, '/link'))) as GroupMemberDto

    expect(linked).toMatchObject({ linked: true, invitedEmail: null })
    expect(memberRow(mock, anna)).toMatchObject({ userId: ANNA, invitedEmail: null, invitedAt: null })
  })

  it('answers 404 to a linked user and for groups and members that are not found', async () => {
    const mock = api()
    const { group, olya, max } = await trip(mock)
    const other = await trip(mock)
    const owned = as(mock, ANNA)
    const linked = as(mock, OLEH)
    linkDirect(mock, olya, OLEH)
    inviteDirect(mock, max, 'max@example.com')
    linkDirect(mock, other.olya, OLEH)
    inviteDirect(mock, other.max, 'other@example.com')
    const mail = { email: 'eve@example.com' }
    const calls: [Caller, HttpMethod, string, unknown][] = [
      [linked, 'PUT', memberPath(group.id, olya, '/link'), undefined],
      [linked, 'PUT', memberPath(group.id, max, '/link'), undefined],
      [linked, 'DELETE', memberPath(group.id, olya, '/link'), undefined],
      [linked, 'PUT', memberPath(group.id, max, '/invite'), mail],
      [linked, 'DELETE', memberPath(group.id, max, '/invite'), undefined],
      [owned, 'PUT', memberPath(group.id, other.anna, '/link'), undefined],
      [owned, 'DELETE', memberPath(group.id, other.olya, '/link'), undefined],
      [owned, 'PUT', memberPath(group.id, other.anna, '/invite'), mail],
      [owned, 'DELETE', memberPath(group.id, other.max, '/invite'), undefined],
      [owned, 'PUT', memberPath(group.id, 'mbr_missing', '/link'), undefined],
      [owned, 'PUT', memberPath('grp_missing', olya, '/link'), undefined],
      [owned, 'DELETE', memberPath('grp_missing', olya, '/link'), undefined],
      [owned, 'PUT', memberPath('grp_missing', olya, '/invite'), mail],
      [owned, 'DELETE', memberPath('grp_missing', max, '/invite'), undefined],
    ]

    for (const [caller, method, path, body] of calls) await notFound(caller.send(method, path, body))

    expect(storedLinks(mock, group.id)).toEqual([null, OLEH, null])
    expect(storedInvites(mock, group.id)).toEqual([null, null, 'max@example.com'])
    expect(storedLinks(mock, other.group.id)).toEqual([null, OLEH, null])
    expect(storedInvites(mock, other.group.id)).toEqual([null, null, 'other@example.com'])
    expect((await getGroup(linked, group.id)).myMemberId).toBe(olya)
  })

  it('drops the link and the invitation of an unused member that is removed', async () => {
    const mock = api()
    const { group, olya, max } = await trip(mock)
    const owned = as(mock, ANNA)
    inviteDirect(mock, max, 'max@example.com')
    linkDirect(mock, olya, OLEH)

    expect(await owned.send('DELETE', memberPath(group.id, max))).toBeUndefined()
    expect(await owned.send('DELETE', memberPath(group.id, olya))).toBeUndefined()

    expect(mock.db.state.groupMembers.filter((row) => row.groupId === group.id).map((row) => row.name)).toEqual([
      'Anna',
    ])
    await notFound(as(mock, OLEH).get(groupPath(group.id)))
  })

  it('creates members without a link and renames a linked member keeping its link', async () => {
    const mock = api()
    const { group, olya } = await trip(mock)
    const owned = as(mock, ANNA)
    linkDirect(mock, olya, OLEH)

    const added = (await owned.send('POST', groupPath(group.id, '/members'), { name: 'Eve' })) as GroupMemberDto
    const renamed = (await owned.send('PUT', memberPath(group.id, olya), { name: 'Ola' })) as GroupMemberDto

    expect(Object.keys(added)).toEqual(MEMBER_KEYS)
    expect(added).toMatchObject({ name: 'Eve', inUse: false, linked: false, linkedName: null, invitedEmail: null })
    expect(Object.keys(renamed)).toEqual(MEMBER_KEYS)
    expect(renamed).toEqual({
      id: olya,
      name: 'Ola',
      inUse: false,
      linked: true,
      linkedName: 'Oleh Kravets',
      invitedEmail: null,
    })
    expect(storedLinks(mock, group.id)).toEqual([null, OLEH, null, null])
    const created = (await createGroup(owned, 'Other')) as GroupDto
    expect(membersOf(created).every((member) => !member.linked && member.invitedEmail === null)).toBe(true)
    expect(created).toMatchObject({ role: 'owner', myMemberId: null })
  })
})

describe('group invitations', () => {
  it('lists the invitations of unlinked members that match the email of the user', async () => {
    const mock = api()
    const { group, olya, max } = await trip(mock)
    const hike = await createGroup(as(mock, ANNA), 'Hike', 'EUR', ['Ann', 'Bob'])
    const hikeAnn = hike.members[0]?.id as string
    const owned = as(mock, ANNA)
    const invitee = as(mock, BOHDAN)
    await invite(owned, group.id, olya, 'BOHDAN@EXAMPLE.com')
    await invite(owned, hike.id, hikeAnn, ' bohdan@example.com')
    memberRow(mock, olya).invitedAt = new Date(Date.now() - 60_000).toISOString()
    const before = Date.now() - 120_000

    const page = (await invitee.get('/v1/group-invites', { page: '1', pageSize: '100' })) as Page<GroupInviteDto>

    expect(page).toMatchObject({ page: 1, pageSize: 100, total: 2 })
    expect(page.items.map((item) => item.memberId)).toEqual([hikeAnn, olya])
    const second = page.items[1] as GroupInviteDto
    expect(Object.keys(second)).toEqual(INVITE_KEYS)
    expect(second).toMatchObject({
      memberId: olya,
      groupId: group.id,
      groupName: 'Trip',
      memberName: 'Olya',
      ownerName: 'Anna Nowak',
    })
    expect(second.invitedAt).toMatch(ISO_MILLISECONDS)
    expect(Date.parse(second.invitedAt)).toBeGreaterThan(before)
    expect(page.items[0]).toMatchObject({ groupName: 'Hike', memberName: 'Ann' })
    expect(((await as(mock, CLEO).get('/v1/group-invites')) as Page<GroupInviteDto>).items).toEqual([])
    expect(((await owned.get('/v1/group-invites')) as Page<GroupInviteDto>).items).toEqual([])

    linkDirect(mock, max, BOHDAN)

    const left = (await invitee.get('/v1/group-invites')) as Page<GroupInviteDto>
    expect(left.items.map((item) => item.memberId)).toEqual([hikeAnn])
  })

  it('orders invitations sent at the same moment by member id, newest first', async () => {
    const mock = api()
    const { olya, max } = await trip(mock)
    const at = new Date().toISOString()
    for (const id of [olya, max]) {
      inviteDirect(mock, id, 'bohdan@example.com')
      memberRow(mock, id).invitedAt = at
    }

    const page = (await as(mock, BOHDAN).get('/v1/group-invites')) as Page<GroupInviteDto>

    expect(page.items.map((item) => item.memberId)).toEqual([olya, max].sort((a, b) => b.localeCompare(a)))
  })

  it('ignores an invitation of a member that a link overtook', async () => {
    const mock = api()
    const { olya } = await trip(mock)
    const row = memberRow(mock, olya)
    row.userId = CLEO
    row.invitedEmail = 'bohdan@example.com'
    row.invitedAt = new Date().toISOString()
    const invitee = as(mock, BOHDAN)

    expect(((await invitee.get('/v1/group-invites')) as Page<GroupInviteDto>).items).toEqual([])
    await notFound(invitee.send('POST', acceptPath(olya)))
    await notFound(invitee.send('POST', declinePath(olya)))
    expect(memberRow(mock, olya).userId).toBe(CLEO)
  })

  it('refuses invalid paging and an anonymous request', async () => {
    const mock = api()

    await refused(as(mock, BOHDAN).get('/v1/group-invites', { pageSize: '101' }), {
      pageSize: ['validation.invalidValue'],
    })
    await refused(as(mock, BOHDAN).get('/v1/group-invites', { page: '0' }), { page: ['validation.invalidValue'] })
    expect(await problemOf(as(mock, null).get('/v1/group-invites'))).toMatchObject({ status: 401 })
  })

  it('accepts an invitation only for the matching email', async () => {
    const mock = api()
    const { group, olya } = await trip(mock)
    const hike = await createGroup(as(mock, ANNA), 'Hike', 'EUR', ['Ann', 'Bob', 'Cy'])
    const [, cancelled, linkedElsewhere] = hike.members.map((member) => member.id) as [string, string, string]
    const owned = as(mock, ANNA)
    const invitee = as(mock, BOHDAN)
    await invite(owned, group.id, olya, 'bohdan@example.com')

    await notFound(as(mock, CLEO).send('POST', acceptPath(olya)))
    expect(storedLinks(mock, group.id)).toEqual([null, null, null])

    const summary = (await invitee.send('POST', acceptPath(olya))) as GroupSummaryDto

    expect(Object.keys(summary)).toEqual(SUMMARY_KEYS)
    expect(summary).toEqual({ id: group.id, name: 'Trip', currency: 'EUR', members: 3, total: 0, role: 'member' })
    expect(memberRow(mock, olya)).toMatchObject({ userId: BOHDAN, invitedEmail: null, invitedAt: null })
    const ownerView = membersOf(await getGroup(owned, group.id))[1]
    expect(ownerView).toMatchObject({ linked: true, linkedName: 'Bohdan', invitedEmail: null })
    const listed = (await invitee.get('/v1/groups')) as Page<GroupSummaryDto>
    expect(listed.items).toEqual([summary])
    expect((await getGroup(invitee, group.id)).myMemberId).toBe(olya)
    await notFound(invitee.send('POST', acceptPath(olya)))

    await invite(owned, hike.id, cancelled, 'bohdan@example.com')
    expect(await owned.send('DELETE', memberPath(hike.id, cancelled, '/invite'))).toBeUndefined()
    inviteDirect(mock, linkedElsewhere, 'bohdan@example.com')
    linkDirect(mock, linkedElsewhere, CLEO)

    await notFound(invitee.send('POST', acceptPath(cancelled)))
    await notFound(invitee.send('POST', acceptPath(linkedElsewhere)))
    await notFound(invitee.send('POST', acceptPath('mbr_missing')))
    expect(storedLinks(mock, hike.id)).toEqual([null, null, CLEO])
    await notFound(invitee.get(groupPath(hike.id)))
  })

  it('declines an invitation', async () => {
    const mock = api()
    const { group, olya } = await trip(mock)
    const owned = as(mock, ANNA)
    const invitee = as(mock, BOHDAN)
    await invite(owned, group.id, olya, 'bohdan@example.com')

    await notFound(as(mock, CLEO).send('POST', declinePath(olya)))
    expect(memberRow(mock, olya).invitedEmail).toBe('bohdan@example.com')

    expect(await invitee.send('POST', declinePath(olya))).toBeUndefined()

    expect(membersOf(await getGroup(owned, group.id)).map((member) => member.invitedEmail)).toEqual([null, null, null])
    expect(memberRow(mock, olya)).toMatchObject({ userId: null, invitedEmail: null, invitedAt: null })
    expect(((await invitee.get('/v1/group-invites')) as Page<GroupInviteDto>).items).toEqual([])
    await notFound(invitee.get(groupPath(group.id)))
    await notFound(invitee.send('POST', declinePath(olya)))
    await notFound(invitee.send('POST', declinePath('mbr_missing')))
  })

  it('refuses to accept while the user is linked to another member of the group', async () => {
    const mock = api()
    const { group, olya, max } = await trip(mock)
    linkDirect(mock, max, BOHDAN)
    inviteDirect(mock, olya, 'bohdan@example.com')

    await refused(as(mock, BOHDAN).send('POST', acceptPath(olya)), { memberId: ['validation.alreadyLinked'] })

    expect(storedLinks(mock, group.id)).toEqual([null, null, BOHDAN])
    expect(storedInvites(mock, group.id)).toEqual([null, 'bohdan@example.com', null])
    expect(((await as(mock, BOHDAN).get('/v1/group-invites')) as Page<GroupInviteDto>).items).toEqual([])
  })

  it('follows a change of the email of the invitee', async () => {
    const mock = api()
    const { group, olya } = await trip(mock)
    const invitee = as(mock, BOHDAN)
    await invite(as(mock, ANNA), group.id, olya, 'bohdan@example.com')
    expect(((await invitee.get('/v1/group-invites')) as Page<GroupInviteDto>).items).toHaveLength(1)

    await invitee.send('PUT', '/v1/me', { name: 'Bohdan', email: 'new-bohdan@example.com' })

    expect(((await invitee.get('/v1/group-invites')) as Page<GroupInviteDto>).items).toEqual([])
    await notFound(invitee.send('POST', acceptPath(olya)))
    await notFound(invitee.send('POST', declinePath(olya)))
    expect(memberRow(mock, olya)).toMatchObject({ userId: null, invitedEmail: 'bohdan@example.com' })

    await invite(as(mock, ANNA), group.id, olya, 'NEW-bohdan@example.com')

    expect(((await invitee.get('/v1/group-invites')) as Page<GroupInviteDto>).items).toHaveLength(1)
  })

  it('lets a linked user leave and keeps the owner in the group', async () => {
    const mock = api()
    const { group, anna, olya } = await trip(mock)
    const owned = as(mock, ANNA)
    const linked = as(mock, OLEH)
    linkDirect(mock, olya, OLEH)

    await notFound(as(mock, BOHDAN).send('DELETE', groupPath(group.id, '/membership')))
    await notFound(owned.send('DELETE', groupPath(group.id, '/membership')))
    expect(storedLinks(mock, group.id)).toEqual([null, OLEH, null])

    expect(await linked.send('DELETE', groupPath(group.id, '/membership'))).toBeUndefined()

    await notFound(linked.get(groupPath(group.id)))
    expect(storedLinks(mock, group.id)).toEqual([null, null, null])
    expect(((await linked.get('/v1/groups')) as Page<GroupSummaryDto>).items).toEqual([])
    await notFound(linked.send('DELETE', groupPath(group.id, '/membership')))
    await notFound(owned.send('DELETE', groupPath('grp_missing', '/membership')))

    linkDirect(mock, anna, ANNA)

    expect(await owned.send('DELETE', groupPath(group.id, '/membership'))).toBeUndefined()
    expect(await getGroup(owned, group.id)).toMatchObject({ role: 'owner', myMemberId: null })
    expect(storedLinks(mock, group.id)).toEqual([null, null, null])
  })
})

describe('linking through the share link', () => {
  const header = (memberId: string) => ({ [GROUP_MEMBER_HEADER]: memberId })

  it('links the member the visitor picked and answers the summary of the group', async () => {
    const mock = api()
    const { group, olya, max, token } = await shared(mock)
    inviteDirect(mock, olya, 'olya@example.com')
    const visitor = as(mock, BOHDAN)

    const summary = (await visitor.send(
      'PUT',
      linkPath(token, '/membership'),
      undefined,
      header(olya),
    )) as GroupSummaryDto

    expect(Object.keys(summary)).toEqual(SUMMARY_KEYS)
    expect(summary).toEqual({ id: group.id, name: 'Trip', currency: 'EUR', members: 3, total: 0, role: 'member' })
    expect(memberRow(mock, olya)).toMatchObject({ userId: BOHDAN, invitedEmail: null, invitedAt: null })
    expect(await getGroup(visitor, group.id)).toMatchObject({ role: 'member', myMemberId: olya })

    expect(await visitor.send('PUT', linkPath(token, '/membership'), undefined, header(olya))).toEqual(summary)
    await refused(visitor.send('PUT', linkPath(token, '/membership'), undefined, header(max)), {
      memberId: ['validation.alreadyLinked'],
    })
    await refused(as(mock, CLEO).send('PUT', linkPath(token, '/membership'), undefined, header(olya)), {
      memberId: ['validation.memberLinked'],
    })
    expect(storedLinks(mock, group.id)).toEqual([null, BOHDAN, null])
    const ownerView = membersOf(await getGroup(as(mock, ANNA), group.id))[1]
    expect(ownerView).toMatchObject({ linked: true, linkedName: 'Bohdan', invitedEmail: null })
  })

  it('answers the summary of the owner when the owner links themselves through their own link', async () => {
    const mock = api()
    const { group, anna, token } = await shared(mock)

    const summary = (await as(mock, ANNA).send('PUT', linkPath(token, '/membership'), undefined, header(anna))) as {
      role: string
    }

    expect(summary).toMatchObject({ id: group.id, role: 'owner' })
    expect(await getGroup(as(mock, ANNA), group.id)).toMatchObject({ role: 'owner', myMemberId: anna })
  })

  it('checks the token, then the session, then the member, then the link rules', async () => {
    const mock = api()
    const { group, anna, olya, max, token } = await shared(mock)
    const foreign = await shared(mock)
    const unknown = 'A'.repeat(43)
    const visitor = as(mock, CLEO)
    const anonymous = as(mock, null)
    const put = (caller: Caller, path: string, member?: string) =>
      caller.send('PUT', path, undefined, member === undefined ? undefined : header(member))

    expect(await problemOf(put(anonymous, linkPath(token, '/membership'), max))).toMatchObject({
      status: 401,
      title: 'Unauthorized',
    })
    expect(await problemOf(put(anonymous, linkPath(token, '/membership')))).toMatchObject({ status: 401 })
    await notFound(put(anonymous, linkPath(unknown, '/membership'), max))
    await notFound(put(visitor, linkPath(unknown, '/membership'), max))
    await memberRequired(put(visitor, linkPath(token, '/membership')))
    await memberRequired(put(visitor, linkPath(token, '/membership'), ''))
    await memberRequired(put(visitor, linkPath(token, '/membership'), foreign.max))
    await memberRequired(put(visitor, linkPath(token, '/membership'), 'not-a-guid'))
    expect(storedLinks(mock, group.id)).toEqual([null, null, null])

    linkDirect(mock, olya, BOHDAN)
    await refused(put(visitor, linkPath(token, '/membership'), olya), { memberId: ['validation.memberLinked'] })
    linkDirect(mock, max, CLEO)
    await refused(put(visitor, linkPath(token, '/membership'), olya), { memberId: ['validation.memberLinked'] })
    await refused(put(visitor, linkPath(token, '/membership'), anna), {
      memberId: ['validation.alreadyLinked'],
    })
  })

  it('does not link anything through the link routes that are not a membership', async () => {
    const mock = api()
    const { group, olya, token } = await shared(mock)

    const read = (await as(mock, BOHDAN).get(linkPath(token))) as GroupDto
    const written = (await as(mock, BOHDAN).send(
      'POST',
      linkPath(token, '/expenses'),
      expenseBody(olya),
      header(olya),
    )) as GroupExpenseDto

    expect(read).toMatchObject({ role: 'link', myMemberId: null })
    expect(written.createdBy).toEqual(actingMember(olya, 'Olya'))
    expect(storedLinks(mock, group.id)).toEqual([null, null, null])
    await notFound(as(mock, BOHDAN).get(groupPath(group.id)))
  })
})

describe('group balances on the Debts page', () => {
  const lent = { direction: 'lent', counterparty: 'Max', amount: 10_000, currency: 'PLN', date: today }

  const world = async () => {
    const mock = api()
    const ownerA = as(mock, ANNA)
    const ownerC = as(mock, CLEO)
    const tripGroup = await createGroup(ownerA, 'Trip', 'EUR', ['Anna', 'Olya', 'Max'])
    const [tripAnna, tripOlya, tripMax] = tripGroup.members.map((member) => member.id) as [string, string, string]
    linkDirect(mock, tripOlya, BOHDAN)
    await ownerA.send('POST', groupPath(tripGroup.id, '/expenses'), expenseBody(tripOlya, 9_000))
    const removed = (await ownerA.send(
      'POST',
      groupPath(tripGroup.id, '/expenses'),
      expenseBody(tripAnna, 5_000),
    )) as GroupExpenseDto
    await ownerA.send('DELETE', groupPath(tripGroup.id, `/expenses/${removed.id}`))

    const home = await createGroup(ownerC, 'Home', 'PLN', ['Cleo', 'Kasia'])
    const [homeCleo, homeKasia] = home.members.map((member) => member.id) as [string, string]
    linkDirect(mock, homeKasia, BOHDAN)
    await ownerC.send('POST', groupPath(home.id, '/expenses'), {
      ...expenseBody(homeCleo, 30_000),
      currency: 'PLN',
    })

    const done = await createGroup(ownerC, 'Done', 'USD', ['Bea', 'Zed'])
    const [doneBea, doneZed] = done.members.map((member) => member.id) as [string, string]
    linkDirect(mock, doneBea, BOHDAN)
    await ownerC.send('POST', groupPath(done.id, '/expenses'), { ...expenseBody(doneBea, 2_000), currency: 'USD' })
    await ownerC.send('POST', groupPath(done.id, '/repayments'), {
      fromMemberId: doneZed,
      toMemberId: doneBea,
      amount: 1_000,
      currency: 'USD',
      date: today,
    })
    return { mock, tripGroup, tripAnna, tripOlya, tripMax, home, done }
  }

  it('lists one line per linked group, settled groups included, in the order of the groups', async () => {
    const { mock, tripGroup, home, done } = await world()
    const linked = as(mock, BOHDAN)

    const page = (await linked.get('/v1/debts/groups')) as Page<GroupDebtDto>

    expect(page).toMatchObject({ page: 1, pageSize: 100, total: 3 })
    expect(page.items).toEqual([
      { groupId: done.id, name: 'Done', currency: 'USD', balance: 0 },
      { groupId: home.id, name: 'Home', currency: 'PLN', balance: -15_000 },
      { groupId: tripGroup.id, name: 'Trip', currency: 'EUR', balance: 6_000 },
    ])
    for (const line of page.items) expect(Object.keys(line)).toEqual(DEBT_LINE_KEYS)

    const second = (await linked.get('/v1/debts/groups', { page: '2', pageSize: '2' })) as Page<GroupDebtDto>
    expect(second.total).toBe(3)
    expect(second.items).toEqual([{ groupId: tripGroup.id, name: 'Trip', currency: 'EUR', balance: 6_000 }])
  })

  it('includes the balances in the summary of the debts and of the overview', async () => {
    const { mock } = await world()
    const linked = as(mock, BOHDAN)
    await linked.send('POST', '/v1/debts', lent)

    const debts = (await linked.get('/v1/debts')) as DebtPage
    const overview = (await linked.get('/v1/overview')) as OverviewDto

    expect(Object.keys(debts.summary)).toEqual(DEBT_SUMMARY_KEYS)
    expect(debts.summary).toEqual({ owedToMe: 35_800, owedByMe: 15_000, open: 1, overdue: 0, groups: 2 })
    expect(overview.debts).toEqual(debts.summary)
    expect(((await linked.get('/v1/debts', { status: 'settled' })) as DebtPage).summary).toEqual(debts.summary)
  })

  it('ignores the groups where the user is not linked, the owner of the group included', async () => {
    const mock = api()
    const ownerA = as(mock, ANNA)
    const linked = as(mock, BOHDAN)
    const { group, anna, olya } = await trip(mock)
    linkDirect(mock, olya, BOHDAN)
    await ownerA.send('POST', groupPath(group.id, '/expenses'), expenseBody(olya, 9_000))

    const unlinked = (await ownerA.get('/v1/debts/groups')) as Page<GroupDebtDto>
    expect(unlinked).toMatchObject({ total: 0, items: [] })
    const summaryOf = async (caller: Caller) => ((await caller.get('/v1/debts')) as DebtPage).summary
    const zeros = { owedToMe: 0, owedByMe: 0, open: 0, overdue: 0, groups: 0 }
    expect(await summaryOf(ownerA)).toEqual(zeros)
    expect(((await ownerA.get('/v1/overview')) as OverviewDto).debts).toEqual(zeros)
    expect(await summaryOf(linked)).toEqual({ ...zeros, owedToMe: 25_800, groups: 1 })

    linkDirect(mock, anna, ANNA)

    expect(((await ownerA.get('/v1/debts/groups')) as Page<GroupDebtDto>).items).toEqual([
      { groupId: group.id, name: 'Trip', currency: 'EUR', balance: -3_000 },
    ])
    expect(await summaryOf(ownerA)).toEqual({ ...zeros, owedByMe: 12_900, groups: 1 })
    expect(((await ownerA.get('/v1/overview')) as OverviewDto).debts).toEqual({ ...zeros, owedByMe: 12_900, groups: 1 })
  })

  it('converts every group on its own and rounds each half away from zero', async () => {
    const mock = api()
    const ownerA = as(mock, ANNA)
    const linked = as(mock, BOHDAN)
    const one = await createGroup(ownerA, 'One', 'EUR', ['Anna', 'Olya'])
    const two = await createGroup(ownerA, 'Two', 'EUR', ['Anna', 'Olya'])
    for (const created of [one, two]) {
      const [payer, debtor] = created.members.map((member) => member.id) as [string, string]
      linkDirect(mock, debtor, BOHDAN)
      await ownerA.send('POST', groupPath(created.id, '/expenses'), expenseBody(payer, 10))
    }

    const summary = ((await linked.get('/v1/debts')) as DebtPage).summary

    expect(summary).toEqual({ owedToMe: 0, owedByMe: 44, open: 0, overdue: 0, groups: 2 })
    const lines = (await linked.get('/v1/debts/groups')) as Page<GroupDebtDto>
    expect(lines.items.map((line) => line.balance)).toEqual([-5, -5])
  })

  it('answers 503 when the main currency of a group with a balance has no stored rate', async () => {
    const mock = api()
    const ownerA = as(mock, ANNA)
    const linked = as(mock, BOHDAN)
    mock.db.state.rates = mock.db.state.rates.filter((row) => row.from !== 'KWD')
    const kuwait = await createGroup(ownerA, 'Kuwait', 'KWD', ['Ali', 'Bea'])
    const [ali, bea] = kuwait.members.map((member) => member.id) as [string, string]
    linkDirect(mock, bea, BOHDAN)
    const zeros = { owedToMe: 0, owedByMe: 0, open: 0, overdue: 0, groups: 0 }
    expect(((await linked.get('/v1/debts')) as DebtPage).summary).toEqual(zeros)

    await ownerA.send('POST', groupPath(kuwait.id, '/expenses'), { ...expenseBody(ali, 5_000), currency: 'KWD' })

    await unavailable(linked.get('/v1/debts'))
    await unavailable(linked.get('/v1/debts', { status: 'settled' }))
    await unavailable(linked.get('/v1/overview'))
    expect(((await linked.get('/v1/debts/groups')) as Page<GroupDebtDto>).items).toEqual([
      { groupId: kuwait.id, name: 'Kuwait', currency: 'KWD', balance: -2_500 },
    ])
  })

  it('refuses invalid paging and an anonymous request', async () => {
    const mock = api()
    const linked = as(mock, BOHDAN)

    await refused(linked.get('/v1/debts/groups', { pageSize: '101' }), { pageSize: ['validation.invalidValue'] })
    await refused(linked.get('/v1/debts/groups', { page: '0' }), { page: ['validation.invalidValue'] })
    expect(await problemOf(as(mock, null).get('/v1/debts/groups'))).toMatchObject({ status: 401 })
  })
})
