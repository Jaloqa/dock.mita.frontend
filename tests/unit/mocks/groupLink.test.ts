import { describe, expect, it } from 'bun:test'
import { createApiClient } from '../../../app/shared/api/client'
import {
  GROUP_MEMBER_HEADER,
  type GroupActorDto,
  type GroupCategoryDto,
  type GroupDto,
  type GroupEntryEvent,
  type GroupExpenseDto,
  type GroupExpenseState,
  type GroupRepaymentDto,
  type GroupRepaymentState,
  type Page,
  type RateDto,
  SHARE_TOKEN_LENGTH,
} from '../../../app/shared/api/contract'
import type { HttpMethod } from '../../../app/shared/api/transport'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import { createMockApi, type MockApi } from '../../../mocks/api'
import { MockHttpError } from '../../../mocks/errors'
import { defaultHandlers } from '../../../mocks/handlers'
import { createMockTransport } from '../../../mocks/transport'
import { loggedInMockApi, quoteRate } from './session'

const today = todayIso()
const day = (offset: number) => addDaysIso(today, offset)
const rateDay = day(-3)

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/

const SEEDED_TOKEN = 'albania-2026-demo-link-0123456789abcdefghij'

const owner: GroupActorDto = { kind: 'owner', memberId: null, name: 'Anna Nowak' }

const actingMember = (memberId: string, name: string): GroupActorDto => ({ kind: 'member', memberId, name })

const linkView = (group: GroupDto): GroupDto => ({ ...group, shareToken: null, role: 'link', myMemberId: null })

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

const api = (): MockApi => {
  const mock = loggedInMockApi()
  Object.assign(mock.db.state, {
    groups: [],
    groupMembers: [],
    groupCategories: [],
    groupExpenses: [],
    groupRepayments: [],
    groupEvents: [],
  })
  quoteRate(mock, 'EUR', 4.3, rateDay)
  quoteRate(mock, 'USD', 3.95, rateDay)
  return mock
}

const signOut = (mock: MockApi) => {
  mock.db.state.activeUserId = null
}

const signIn = (mock: MockApi, userId = 'usr_anna') => {
  mock.db.state.activeUserId = userId
}

const ownerPath = (groupId: string, suffix = '') => `/v1/groups/${groupId}${suffix}`
const linkPath = (token: string, suffix = '') => `/v1/shared/groups/${token}${suffix}`

const ownerGet = (mock: MockApi, groupId: string, suffix = '', query?: Record<string, string>) =>
  mock.handle({ method: 'GET', path: ownerPath(groupId, suffix), query })

const ownerSend = (mock: MockApi, method: HttpMethod, groupId: string, suffix: string, body?: unknown) =>
  mock.handle({ method, path: ownerPath(groupId, suffix), body })

const linkGet = (mock: MockApi, token: string, suffix = '', query?: Record<string, string>, member?: string) =>
  mock.handle({
    method: 'GET',
    path: linkPath(token, suffix),
    query,
    headers: member === undefined ? undefined : { [GROUP_MEMBER_HEADER]: member },
  })

const linkSend = (
  mock: MockApi,
  method: HttpMethod,
  token: string,
  suffix: string,
  member: string | undefined,
  body?: unknown,
) =>
  mock.handle({
    method,
    path: linkPath(token, suffix),
    body,
    headers: member === undefined ? undefined : { [GROUP_MEMBER_HEADER]: member },
  })

const createGroup = (mock: MockApi, patch: Record<string, unknown> = {}) =>
  mock.handle({
    method: 'POST',
    path: '/v1/groups',
    body: { name: 'Trip', currency: 'EUR', members: ['Anna', 'Olya', 'Max'], ...patch },
  }) as Promise<GroupDto>

const share = (mock: MockApi, groupId: string) => ownerSend(mock, 'POST', groupId, '/share') as Promise<GroupDto>

const unshare = (mock: MockApi, groupId: string) => ownerSend(mock, 'DELETE', groupId, '/share')

const getGroup = (mock: MockApi, groupId: string) => ownerGet(mock, groupId) as Promise<GroupDto>

const tokenOf = (group: GroupDto): string => {
  if (group.shareToken === null) throw new Error('The link is off.')
  return group.shareToken
}

const trip = async (mock: MockApi, patch: Record<string, unknown> = {}) => {
  const group = await createGroup(mock, patch)
  const [anna, olya, max] = group.members.map((member) => member.id) as [string, string, string]
  return { group, anna, olya, max }
}

const linked = async (mock: MockApi, patch: Record<string, unknown> = {}) => {
  const created = await trip(mock, patch)
  return { ...created, token: tokenOf(await share(mock, created.group.id)) }
}

const expenseBody = (payerId: string, amount = 9_000) => ({ payerId, amount, currency: 'EUR', date: today })

const repaymentBody = (fromMemberId: string, toMemberId: string, amount = 2_000) => ({
  fromMemberId,
  toMemberId,
  amount,
  currency: 'EUR',
  date: today,
})

const sharedTrip = async (mock: MockApi, patch: Record<string, unknown> = {}) => {
  const { group, anna, olya, max } = await trip(mock, patch)
  const addExpense = (body: unknown) => ownerSend(mock, 'POST', group.id, '/expenses', body) as Promise<GroupExpenseDto>
  const addRepayment = (body: unknown) =>
    ownerSend(mock, 'POST', group.id, '/repayments', body) as Promise<GroupRepaymentDto>
  const live = await addExpense(expenseBody(anna))
  await addExpense({ ...expenseBody(olya, 3_000), date: day(-1), split: { mode: 'equal', memberIds: [anna, olya] } })
  const removed = await addExpense(expenseBody(max, 1_500))
  await ownerSend(mock, 'DELETE', group.id, `/expenses/${removed.id}`)
  const repayment = await addRepayment(repaymentBody(max, anna))
  const removedRepayment = await addRepayment(repaymentBody(olya, anna, 1_000))
  await ownerSend(mock, 'DELETE', group.id, `/repayments/${removedRepayment.id}`)
  return {
    group,
    anna,
    olya,
    max,
    live,
    removed,
    repayment,
    removedRepayment,
    token: tokenOf(await share(mock, group.id)),
  }
}

const counts = (mock: MockApi, groupId: string) => {
  const { state } = mock.db
  const inGroup = <T extends { groupId: string }>(rows: readonly T[]) =>
    rows.filter((row) => row.groupId === groupId).length
  return {
    expenses: inGroup(state.groupExpenses),
    repayments: inGroup(state.groupRepayments),
    events: inGroup(state.groupEvents),
    categories: inGroup(state.groupCategories),
  }
}

const noEntries = { expenses: 0, repayments: 0, events: 0, categories: 0 }

describe('group share link of the owner', () => {
  it('turns the link on with a new token that the owner reads again', async () => {
    const mock = api()
    const { group } = await trip(mock)
    expect(group.shareToken).toBeNull()
    expect((await getGroup(mock, group.id)).shareToken).toBeNull()

    const shared = await share(mock, group.id)

    expect(shared).toEqual({ ...group, shareToken: shared.shareToken })
    expect(shared.shareToken).toMatch(TOKEN_SHAPE)
    expect(shared.shareToken).toHaveLength(SHARE_TOKEN_LENGTH)
    expect((await getGroup(mock, group.id)).shareToken).toBe(shared.shareToken)
    expect(mock.db.state.groups.find((row) => row.id === group.id)?.shareToken).toBe(shared.shareToken)
    const edited = (await ownerSend(mock, 'PUT', group.id, '', { name: 'Lisbon', currency: 'EUR' })) as GroupDto
    expect(edited).toMatchObject({ name: 'Lisbon', shareToken: shared.shareToken })
  })

  it('replaces the token when the link is made again and locks the old one out at once', async () => {
    const mock = api()
    const { group } = await trip(mock)
    const first = tokenOf(await share(mock, group.id))
    expect(await linkGet(mock, first)).toMatchObject({ id: group.id })

    const second = tokenOf(await share(mock, group.id))

    expect(second).toMatch(TOKEN_SHAPE)
    expect(second).not.toBe(first)
    expect((await getGroup(mock, group.id)).shareToken).toBe(second)
    expect(mock.db.state.groups.filter((row) => row.shareToken === first)).toHaveLength(0)
    await notFound(linkGet(mock, first))
    expect(await linkGet(mock, second)).toMatchObject({ id: group.id })
  })

  it('turns the link off, also when it is off already', async () => {
    const mock = api()
    const { group } = await trip(mock)
    expect(await unshare(mock, group.id)).toBeUndefined()
    expect((await getGroup(mock, group.id)).shareToken).toBeNull()

    const token = tokenOf(await share(mock, group.id))
    expect(await unshare(mock, group.id)).toBeUndefined()
    expect(await unshare(mock, group.id)).toBeUndefined()

    expect((await getGroup(mock, group.id)).shareToken).toBeNull()
    await notFound(linkGet(mock, token))
  })

  it('turns the link on again with another token after it was off', async () => {
    const mock = api()
    const { group } = await trip(mock)
    const first = tokenOf(await share(mock, group.id))
    await unshare(mock, group.id)

    const second = tokenOf(await share(mock, group.id))

    expect(second).not.toBe(first)
    await notFound(linkGet(mock, first))
    expect(await linkGet(mock, second)).toMatchObject({ id: group.id })
  })

  it('draws a different well-formed token every time', async () => {
    const mock = api()
    const { group } = await trip(mock)
    const tokens: string[] = []
    for (let index = 0; index < 25; index++) tokens.push(tokenOf(await share(mock, group.id)))
    expect(new Set(tokens).size).toBe(tokens.length)
    expect(tokens.every((token) => TOKEN_SHAPE.test(token))).toBe(true)
  })

  it('keeps the links of two groups apart', async () => {
    const mock = api()
    const first = await linked(mock, { name: 'First' })
    const second = await linked(mock, { name: 'Second' })

    await share(mock, first.group.id)
    await unshare(mock, first.group.id)

    expect((await getGroup(mock, first.group.id)).shareToken).toBeNull()
    expect((await getGroup(mock, second.group.id)).shareToken).toBe(second.token)
    expect(await linkGet(mock, second.token)).toMatchObject({ id: second.group.id, name: 'Second' })
  })

  it('answers 404 for an unknown or foreign group and 401 without a session', async () => {
    const mock = api()
    const { group } = await trip(mock)
    const token = tokenOf(await share(mock, group.id))
    const closed = await trip(mock, { name: 'Closed' })

    await notFound(share(mock, 'grp_missing'))
    await notFound(unshare(mock, 'grp_missing'))
    signIn(mock, 'usr_oleh')
    await notFound(share(mock, group.id))
    await notFound(unshare(mock, group.id))
    await notFound(share(mock, closed.group.id))
    signOut(mock)
    const expired = { status: 401, code: 'auth.sessionExpired' }
    expect(await problemOf(share(mock, group.id))).toMatchObject(expired)
    expect(await problemOf(unshare(mock, group.id))).toMatchObject(expired)

    signIn(mock)
    expect((await getGroup(mock, group.id)).shareToken).toBe(token)
    expect((await getGroup(mock, closed.group.id)).shareToken).toBeNull()
  })

  it('drops the link together with its group and gives a new group no link', async () => {
    const mock = api()
    const first = await linked(mock, { name: 'First' })
    const created = await createGroup(mock, { name: 'Second' })
    expect(created.shareToken).toBeNull()

    await ownerSend(mock, 'DELETE', first.group.id, '')

    await notFound(linkGet(mock, first.token))
    expect(await getGroup(mock, created.id)).toMatchObject({ shareToken: null })
  })
})

describe('group link reads', () => {
  it('serves every read anonymously exactly like the owner routes', async () => {
    const mock = api()
    const { group, token, live, repayment } = await sharedTrip(mock)
    const reads: [string, Record<string, string>?][] = [
      ['/expenses'],
      ['/expenses', { deleted: 'true' }],
      ['/expenses', { pageSize: '1', page: '2' }],
      ['/repayments'],
      ['/repayments', { deleted: 'true' }],
      [`/expenses/${live.id}/history`],
      [`/repayments/${repayment.id}/history`],
      ['/balances'],
      ['/balances', { currency: 'PLN' }],
    ]
    const ownerGroup = await getGroup(mock, group.id)
    const ownerAnswers = await Promise.all(reads.map(([suffix, query]) => ownerGet(mock, group.id, suffix, query)))
    signOut(mock)

    const linkGroup = (await linkGet(mock, token)) as GroupDto
    const linkAnswers = await Promise.all(reads.map(([suffix, query]) => linkGet(mock, token, suffix, query)))

    expect(ownerGroup.shareToken).toBe(token)
    expect(linkGroup.shareToken).toBeNull()
    expect(linkGroup).toEqual(linkView(ownerGroup))
    expect(linkAnswers).toEqual(ownerAnswers)
    expect((linkAnswers[0] as Page<GroupExpenseDto>).items).toHaveLength(2)
    expect((linkAnswers[1] as Page<GroupExpenseDto>).items).toHaveLength(1)
    expect((linkAnswers[3] as Page<GroupRepaymentDto>).items).toHaveLength(1)
    expect((linkAnswers[4] as Page<GroupRepaymentDto>).items).toHaveLength(1)
  })

  it('applies the validation of the owner routes to the queries of a read', async () => {
    const mock = api()
    const { token, live } = await sharedTrip(mock)
    signOut(mock)
    const invalid = { deleted: 'yes', page: '0', pageSize: '101' }
    const errors = {
      page: ['validation.invalidValue'],
      pageSize: ['validation.invalidValue'],
      deleted: ['validation.invalidValue'],
    }

    await refused(linkGet(mock, token, '/expenses', invalid), errors)
    await refused(linkGet(mock, token, '/repayments', { page: '0' }), { page: ['validation.invalidValue'] })
    await refused(linkGet(mock, token, `/expenses/${live.id}/history`, { pageSize: '0' }), {
      pageSize: ['validation.invalidValue'],
    })
    await refused(linkGet(mock, token, '/balances', { currency: 'eur' }), { currency: ['validation.invalidValue'] })
    await notFound(linkGet(mock, 'A'.repeat(SHARE_TOKEN_LENGTH), '/expenses', invalid))
  })

  it('serves the rates like /v1/rates', async () => {
    const mock = api()
    const { token } = await sharedTrip(mock)
    const queries: Record<string, string>[] = [{ to: 'EUR' }, { from: 'EUR', to: 'PLN' }, { to: 'EUR', date: rateDay }]
    const ownerAnswers = await Promise.all(
      queries.map((query) => mock.handle({ method: 'GET', path: '/v1/rates', query })),
    )
    signOut(mock)

    const linkAnswers = await Promise.all(queries.map((query) => linkGet(mock, token, '/rates', query)))

    expect(linkAnswers).toEqual(ownerAnswers)
    expect((linkAnswers[1] as RateDto[]).map((rate) => [rate.from, rate.to])).toEqual([['EUR', 'PLN']])
    await refused(linkGet(mock, token, '/rates'), { to: ['validation.required'] })
    await refused(linkGet(mock, token, '/rates', { to: 'EUR', date: 'yesterday' }), {
      date: ['validation.invalidValue'],
    })
    await notFound(linkGet(mock, 'A'.repeat(SHARE_TOKEN_LENGTH), '/rates', { to: 'EUR' }))
    await notFound(linkGet(mock, 'A'.repeat(SHARE_TOKEN_LENGTH), '/rates'))
  })

  it('ignores the member header on reads', async () => {
    const mock = api()
    const { token } = await sharedTrip(mock)
    signOut(mock)

    expect(await linkGet(mock, token, '', undefined, 'mbr_unknown')).toMatchObject({ shareToken: null })
    expect((await linkGet(mock, token, '/expenses', undefined, 'x')) as Page<GroupExpenseDto>).toMatchObject({
      total: 2,
    })
  })

  it('answers 404 for an unknown, malformed or turned-off token on every route', async () => {
    const mock = api()
    const { group, token, live, repayment, anna } = await sharedTrip(mock)
    const reads = (candidate: string): (() => Promise<unknown>)[] => [
      () => linkGet(mock, candidate),
      () => linkGet(mock, candidate, '/expenses'),
      () => linkGet(mock, candidate, '/repayments', { deleted: 'true' }),
      () => linkGet(mock, candidate, `/expenses/${live.id}/history`),
      () => linkGet(mock, candidate, `/repayments/${repayment.id}/history`),
      () => linkGet(mock, candidate, '/balances'),
      () => linkGet(mock, candidate, '/rates', { to: 'EUR' }),
    ]
    const writes = (candidate: string): (() => Promise<unknown>)[] => [
      () => linkSend(mock, 'POST', candidate, '/expenses', anna, expenseBody(anna)),
      () => linkSend(mock, 'POST', candidate, '/categories', anna, { name: 'Ferry' }),
      () => linkSend(mock, 'PUT', candidate, `/expenses/${live.id}`, anna, expenseBody(anna)),
      () => linkSend(mock, 'DELETE', candidate, `/repayments/${repayment.id}`, anna),
    ]
    const before = counts(mock, group.id)
    signOut(mock)

    for (const unusable of ['A'.repeat(SHARE_TOKEN_LENGTH), 'abc', `${token}A`, token.slice(1), '!'.repeat(43)]) {
      for (const call of [...reads(unusable), ...writes(unusable)]) await notFound(call())
    }
    for (const call of reads(token)) await call()

    signIn(mock)
    await unshare(mock, group.id)
    signOut(mock)
    for (const call of [...reads(token), ...writes(token)]) await notFound(call())
    expect(counts(mock, group.id)).toEqual(before)
  })

  it('confines the link to its group', async () => {
    const mock = api()
    const shared = await sharedTrip(mock, { name: 'Shared' })
    const other = await sharedTrip(mock, { name: 'Other' })
    const before = { ...counts(mock, shared.group.id), other: counts(mock, other.group.id) }
    signOut(mock)

    await notFound(linkGet(mock, shared.token, `/expenses/${other.live.id}/history`))
    await notFound(linkGet(mock, shared.token, `/repayments/${other.repayment.id}/history`))
    await notFound(linkSend(mock, 'POST', shared.token, '/members', shared.anna, { name: 'Eve' }))
    await notFound(linkSend(mock, 'PUT', shared.token, `/members/${shared.anna}`, shared.anna, { name: 'Eve' }))
    await notFound(linkSend(mock, 'POST', shared.token, '/share', shared.anna))
    await notFound(linkSend(mock, 'DELETE', shared.token, '/share', shared.anna))
    for (const method of ['PUT', 'DELETE'] as const) {
      const problem = await problemOf(
        linkSend(mock, method, shared.token, '', shared.anna, { name: 'Renamed', currency: 'PLN' }),
      )
      expect([404, 405]).toContain(problem.status)
    }
    for (const path of [ownerPath(shared.group.id), '/v1/accounts', '/v1/me', '/v1/groups']) {
      expect(await problemOf(mock.handle({ method: 'GET', path }))).toMatchObject({ status: 401 })
    }

    signIn(mock)
    expect(await getGroup(mock, shared.group.id)).toMatchObject({
      name: 'Shared',
      currency: 'EUR',
      shareToken: shared.token,
      members: [{ name: 'Anna' }, { name: 'Olya' }, { name: 'Max' }],
    })
    expect({ ...counts(mock, shared.group.id), other: counts(mock, other.group.id) }).toEqual(before)
  })

  it('treats a signed-in visitor like an anonymous one and never gives the owner powers', async () => {
    const mock = api()
    const { group, token } = await sharedTrip(mock)
    const ownerView = await getGroup(mock, group.id)

    expect(await linkGet(mock, token)).toEqual(linkView(ownerView))
    signIn(mock, 'usr_oleh')
    expect(await linkGet(mock, token)).toEqual(linkView(ownerView))
    await notFound(ownerGet(mock, group.id))
    await notFound(linkGet(mock, 'A'.repeat(SHARE_TOKEN_LENGTH)))
    signOut(mock)
    expect(await linkGet(mock, token)).toEqual(linkView(ownerView))
  })

  it('opens the demo group through its seeded link without a session', async () => {
    const mock = createMockApi({ register: defaultHandlers })
    expect(mock.db.state.activeUserId).toBeNull()

    const group = (await linkGet(mock, SEEDED_TOKEN)) as GroupDto
    const expenses = (await linkGet(mock, SEEDED_TOKEN, '/expenses')) as Page<GroupExpenseDto>

    expect(group).toMatchObject({ id: 'grp_albania', name: 'Albania 2026', shareToken: null })
    expect(group.members.map((member) => member.name)).toEqual(['Anna', 'Olya', 'Max', 'Kasia'])
    expect(expenses.total).toBe(3)
    await notFound(linkGet(mock, SEEDED_TOKEN.replace('demo', 'demx')))
  })
})

describe('group link writes', () => {
  it('refuses a write without a member of the group and writes nothing', async () => {
    const mock = api()
    const { group, anna, olya, token } = await linked(mock)
    const foreign = await trip(mock, { name: 'Other' })
    signOut(mock)

    for (const header of [undefined, '', 'x', 'mbr_unknown', foreign.anna, token]) {
      await memberRequired(linkSend(mock, 'POST', token, '/expenses', header, expenseBody(anna)))
    }
    expect(counts(mock, group.id)).toEqual(noEntries)
    await refused(linkSend(mock, 'POST', token, '/expenses', undefined, { ...expenseBody(anna), amount: 0 }), {
      amount: ['validation.positiveAmount'],
    })

    const created = (await linkSend(mock, 'POST', token, '/expenses', olya, expenseBody(anna))) as GroupExpenseDto

    expect(created).toMatchObject({ payerId: anna, amount: 9_000, createdBy: actingMember(olya, 'Olya') })
    expect(counts(mock, group.id)).toEqual({ expenses: 1, repayments: 0, events: 1, categories: 0 })
  })

  it('refuses every write without a member and changes nothing', async () => {
    const mock = api()
    const { group, token, anna, max, live, removed, repayment, removedRepayment } = await sharedTrip(mock)
    const writes: [HttpMethod, string, unknown][] = [
      ['POST', '/categories', { name: 'Ferry' }],
      ['POST', '/expenses', expenseBody(anna)],
      ['PUT', `/expenses/${live.id}`, expenseBody(anna, 12_000)],
      ['DELETE', `/expenses/${live.id}`, undefined],
      ['POST', `/expenses/${removed.id}/restore`, undefined],
      ['POST', '/repayments', repaymentBody(max, anna)],
      ['PUT', `/repayments/${repayment.id}`, repaymentBody(max, anna, 2_500)],
      ['DELETE', `/repayments/${repayment.id}`, undefined],
      ['POST', `/repayments/${removedRepayment.id}/restore`, undefined],
    ]
    const before = JSON.stringify(mock.db.state.groupEvents)
    const entries = JSON.stringify([mock.db.state.groupExpenses, mock.db.state.groupRepayments])
    const stored = counts(mock, group.id)
    signOut(mock)

    for (const [method, suffix, body] of writes)
      await memberRequired(linkSend(mock, method, token, suffix, undefined, body))
    for (const [method, suffix, body] of writes)
      await memberRequired(linkSend(mock, method, token, suffix, 'mbr_x', body))

    expect(counts(mock, group.id)).toEqual(stored)
    expect(JSON.stringify(mock.db.state.groupEvents)).toBe(before)
    expect(JSON.stringify([mock.db.state.groupExpenses, mock.db.state.groupRepayments])).toBe(entries)

    await memberRequired(linkSend(mock, 'DELETE', token, '/expenses/gexp_missing', undefined))
    await notFound(linkSend(mock, 'DELETE', token, '/expenses/gexp_missing', anna))
  })

  it('checks the shape first, then the group, the member, the entry and the references', async () => {
    const mock = api()
    const { token, anna, live } = await sharedTrip(mock)
    const unknownToken = 'A'.repeat(SHARE_TOKEN_LENGTH)
    signOut(mock)
    const invalid = { ...expenseBody(anna), amount: 0 }
    const unknownPayer = { ...expenseBody(anna), payerId: 'mbr_unknown' }

    await notFound(linkSend(mock, 'POST', unknownToken, '/expenses', undefined, invalid))
    await refused(linkSend(mock, 'POST', token, '/expenses', undefined, invalid), {
      amount: ['validation.positiveAmount'],
    })
    await refused(linkSend(mock, 'PUT', token, `/expenses/${live.id}`, undefined, invalid), {
      amount: ['validation.positiveAmount'],
    })
    await refused(linkSend(mock, 'POST', token, '/categories', undefined, { name: ' ' }), {
      name: ['validation.required'],
    })
    await memberRequired(linkSend(mock, 'POST', token, '/expenses', undefined, unknownPayer))
    await refused(linkSend(mock, 'POST', token, '/expenses', anna, unknownPayer), {
      payerId: ['validation.unknownMember'],
    })
    await memberRequired(linkSend(mock, 'PUT', token, '/expenses/gexp_missing', undefined, expenseBody(anna)))
    await notFound(linkSend(mock, 'PUT', token, '/expenses/gexp_missing', anna, expenseBody(anna)))
  })

  it('records the member as the actor of every change and the owner routes keep the owner', async () => {
    const mock = api()
    const { group, anna, olya, max, token } = await linked(mock)
    const body = { ...expenseBody(anna), split: { mode: 'equal', memberIds: [anna, max] } }
    const inUse = async () => ((await linkGet(mock, token)) as GroupDto).members.map((row) => [row.name, row.inUse])
    signOut(mock)
    expect(await inUse()).toEqual([
      ['Anna', false],
      ['Olya', false],
      ['Max', false],
    ])

    const created = (await linkSend(mock, 'POST', token, '/expenses', olya, body)) as GroupExpenseDto

    expect(created.createdBy).toEqual(actingMember(olya, 'Olya'))
    expect(created.updatedBy).toBeNull()
    expect(created.shares.map((share) => share.memberId)).toEqual([anna, max])
    expect(await inUse()).toEqual([
      ['Anna', true],
      ['Olya', true],
      ['Max', true],
    ])

    signIn(mock)
    const edited = (await ownerSend(mock, 'PUT', group.id, `/expenses/${created.id}`, {
      ...body,
      amount: 12_000,
    })) as GroupExpenseDto
    expect(edited.createdBy).toEqual(actingMember(olya, 'Olya'))
    expect(edited.updatedBy).toEqual(owner)

    signOut(mock)
    expect(await linkSend(mock, 'DELETE', token, `/expenses/${created.id}`, olya)).toBeUndefined()
    const restored = (await linkSend(mock, 'POST', token, `/expenses/${created.id}/restore`, olya)) as GroupExpenseDto
    expect(restored).toMatchObject({ deleted: false, amount: 12_000 })
    expect(restored.createdBy).toEqual(actingMember(olya, 'Olya'))
    expect(restored.updatedBy).toEqual(actingMember(olya, 'Olya'))

    const history = (await linkGet(mock, token, `/expenses/${created.id}/history`)) as Page<
      GroupEntryEvent<GroupExpenseState>
    >
    expect(history.items.map((event) => event.action)).toEqual(['restored', 'deleted', 'updated', 'created'])
    expect(history.items.map((event) => event.actor)).toEqual([
      actingMember(olya, 'Olya'),
      actingMember(olya, 'Olya'),
      owner,
      actingMember(olya, 'Olya'),
    ])
    expect(
      mock.db.state.groupEvents
        .filter((event) => event.entryId === created.id)
        .map((event) => [event.actorUserId, event.actorMemberId]),
    ).toEqual([
      [null, olya],
      ['usr_anna', null],
      [null, olya],
      [null, olya],
    ])
  })

  it('makes the owner who writes through the link act as the member they chose', async () => {
    const mock = api()
    const { group, anna, max, token } = await linked(mock)

    const created = (await linkSend(mock, 'POST', token, '/expenses', max, expenseBody(anna))) as GroupExpenseDto
    const viaOwnerRoute = (await ownerSend(mock, 'POST', group.id, '/expenses', expenseBody(anna))) as GroupExpenseDto

    expect(created.createdBy).toEqual(actingMember(max, 'Max'))
    expect(viaOwnerRoute.createdBy).toEqual(owner)
    expect(mock.db.state.groupEvents.find((event) => event.entryId === created.id)).toMatchObject({
      actorUserId: null,
      actorMemberId: max,
    })
  })

  it('writes repayments and categories through the link', async () => {
    const mock = api()
    const { group, anna, olya, max, token } = await linked(mock)
    signOut(mock)

    const created = (await linkSend(
      mock,
      'POST',
      token,
      '/repayments',
      max,
      repaymentBody(max, anna),
    )) as GroupRepaymentDto
    expect(created).toMatchObject({ fromMemberId: max, toMemberId: anna, createdBy: actingMember(max, 'Max') })

    const edited = (await linkSend(
      mock,
      'PUT',
      token,
      `/repayments/${created.id}`,
      max,
      repaymentBody(max, anna, 2_500),
    )) as GroupRepaymentDto
    expect(edited).toMatchObject({ amount: 2_500, updatedBy: actingMember(max, 'Max') })

    expect(await linkSend(mock, 'DELETE', token, `/repayments/${created.id}`, max)).toBeUndefined()
    const restored = (await linkSend(
      mock,
      'POST',
      token,
      `/repayments/${created.id}/restore`,
      max,
    )) as GroupRepaymentDto
    expect(restored.deleted).toBe(false)
    const history = (await linkGet(mock, token, `/repayments/${created.id}/history`)) as Page<
      GroupEntryEvent<GroupRepaymentState>
    >
    expect(history.items.map((event) => event.action)).toEqual(['restored', 'deleted', 'updated', 'created'])
    expect(history.items.map((event) => event.actor)).toEqual(Array(4).fill(actingMember(max, 'Max')))

    const category = (await linkSend(mock, 'POST', token, '/categories', olya, { name: ' Ferry ' })) as GroupCategoryDto
    expect(category).toMatchObject({ standard: false, name: 'Ferry' })
    expect(((await linkGet(mock, token)) as GroupDto).categories.at(-1)).toEqual(category)
    await refused(linkSend(mock, 'POST', token, '/categories', olya, { name: 'ferry' }), {
      name: ['validation.categoryNameTaken'],
    })
    expect(counts(mock, group.id)).toMatchObject({ repayments: 1, categories: 1 })
  })

  it('refuses the entries, members and categories of another group', async () => {
    const mock = api()
    const { group, anna, max, token } = await linked(mock, { name: 'Shared' })
    const other = await sharedTrip(mock, { name: 'Other' })
    const ferry = (await ownerSend(mock, 'POST', other.group.id, '/categories', { name: 'Ferry' })) as GroupCategoryDto
    const before = counts(mock, other.group.id)
    signOut(mock)
    const foreign: [HttpMethod, string, unknown][] = [
      ['PUT', `/expenses/${other.live.id}`, expenseBody(anna)],
      ['DELETE', `/expenses/${other.live.id}`, undefined],
      ['POST', `/expenses/${other.removed.id}/restore`, undefined],
      ['PUT', `/repayments/${other.repayment.id}`, repaymentBody(max, anna)],
      ['DELETE', `/repayments/${other.repayment.id}`, undefined],
      ['POST', `/repayments/${other.removedRepayment.id}/restore`, undefined],
    ]

    for (const [method, suffix, body] of foreign) await notFound(linkSend(mock, method, token, suffix, anna, body))
    await refused(
      linkSend(mock, 'POST', token, '/expenses', anna, {
        ...expenseBody(other.anna),
        categoryId: ferry.id,
        split: { mode: 'equal', memberIds: [anna, other.olya] },
      }),
      {
        payerId: ['validation.unknownMember'],
        categoryId: ['validation.unknownCategory'],
        split: ['validation.unknownMember'],
      },
    )
    await refused(linkSend(mock, 'POST', token, '/repayments', anna, repaymentBody(other.max, anna)), {
      fromMemberId: ['validation.unknownMember'],
    })

    expect(counts(mock, group.id)).toEqual(noEntries)
    expect(counts(mock, other.group.id)).toEqual(before)
    expect(mock.db.state.groupExpenses.filter((row) => row.groupId === other.group.id && row.deleted)).toHaveLength(1)
  })

  it('answers 404 once the link is replaced or turned off and writes nothing', async () => {
    const mock = api()
    const { group, anna, olya, token: replaced } = await linked(mock)
    const token = tokenOf(await share(mock, group.id))
    signOut(mock)

    await notFound(linkSend(mock, 'POST', replaced, '/expenses', olya, expenseBody(anna)))
    expect(await linkSend(mock, 'POST', token, '/expenses', olya, expenseBody(anna))).toMatchObject({ amount: 9_000 })
    signIn(mock)
    await unshare(mock, group.id)
    signOut(mock)
    await notFound(linkSend(mock, 'POST', token, '/expenses', olya, expenseBody(anna)))

    expect(counts(mock, group.id)).toEqual({ expenses: 1, repayments: 0, events: 1, categories: 0 })
  })

  it('reads the member header whatever the case of its name', async () => {
    const mock = api()
    const { group, anna, olya, token } = await linked(mock)
    signOut(mock)

    for (const name of ['x-group-member', 'X-GROUP-MEMBER', 'X-Group-Member']) {
      const created = (await mock.handle({
        method: 'POST',
        path: linkPath(token, '/expenses'),
        body: expenseBody(anna),
        headers: { [name]: olya },
      })) as GroupExpenseDto
      expect(created.createdBy).toEqual(actingMember(olya, 'Olya'))
    }
    expect(counts(mock, group.id).expenses).toBe(3)
  })

  it('carries the member header of the api client through the mock transport', async () => {
    const mock = api()
    const { anna, olya, token } = await linked(mock)
    signOut(mock)
    const client = createApiClient(createMockTransport(mock, () => 0))

    const created = await client.post<GroupExpenseDto>(linkPath(token, '/expenses'), expenseBody(anna), {
      headers: { [GROUP_MEMBER_HEADER]: olya },
    })
    const refusedWrite = await client.post(linkPath(token, '/expenses'), expenseBody(anna)).catch((e: unknown) => e)
    const read = await client.get<GroupDto>(linkPath(token))

    expect(created.createdBy).toEqual(actingMember(olya, 'Olya'))
    expect(refusedWrite).toMatchObject({ status: 403, code: 'group.memberRequired' })
    expect(read.members.find((member) => member.id === olya)?.inUse).toBe(true)
  })
})
