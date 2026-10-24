import { describe, expect, it } from 'bun:test'
import {
  GROUP_MEMBER_HEADER,
  type GroupDto,
  type GroupEntryEvent,
  type GroupExpenseDto,
  type GroupRepaymentDto,
  type GroupRepaymentState,
  type OpenShareDto,
  type Page,
} from '../../../app/shared/api/contract'
import type { HttpMethod } from '../../../app/shared/api/transport'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import type { MockApi } from '../../../mocks/api'
import { allocateCovers, reallocateCovers } from '../../../mocks/covers'
import { MockHttpError } from '../../../mocks/errors'
import { loggedInMockApi, quoteRate } from './session'

const today = todayIso()
const day = (offset: number) => addDaysIso(today, offset)

const [E1, E2, E3] = ['gex_e1', 'gex_e2', 'gex_e3'] as const
const shares = [
  { expenseId: E1, open: 3_000 },
  { expenseId: E2, open: 2_000 },
]
const cover = (expenseId: string, groupAmount: number) => ({ expenseId, groupAmount })

describe('cover allocation', () => {
  it('covers every share when the amount matches the open total', () => {
    expect(allocateCovers(5_000, shares, [])).toEqual([cover(E1, 3_000), cover(E2, 2_000)])
  })

  it('covers the oldest shares first when the amount is smaller', () => {
    expect(allocateCovers(4_000, shares, [])).toEqual([cover(E1, 3_000), cover(E2, 1_000)])
  })

  it('covers the requested shares first', () => {
    expect(allocateCovers(4_000, shares, [E2])).toEqual([cover(E2, 2_000), cover(E1, 2_000)])
  })

  it('leaves the rest uncovered when the amount exceeds the open total', () => {
    expect(allocateCovers(6_000, shares, [])).toEqual([cover(E1, 3_000), cover(E2, 2_000)])
  })

  it('skips shares with nothing open', () => {
    expect(
      allocateCovers(
        1_000,
        [
          { expenseId: E1, open: 0 },
          { expenseId: E2, open: 2_000 },
        ],
        [],
      ),
    ).toEqual([cover(E2, 1_000)])
  })

  it('covers the previous shares first in their order when reallocated', () => {
    expect(reallocateCovers(4_000, shares, [E2, E1])).toEqual([cover(E2, 2_000), cover(E1, 2_000)])
  })

  it('covers the oldest shares first when the previous shares are no longer open', () => {
    expect(
      reallocateCovers(
        3_000,
        [
          { expenseId: E2, open: 2_000 },
          { expenseId: E3, open: 4_000 },
        ],
        [E1],
      ),
    ).toEqual([cover(E2, 2_000), cover(E3, 1_000)])
  })

  it('covers the rest oldest first when the previous shares are smaller', () => {
    expect(
      reallocateCovers(
        4_000,
        [
          { expenseId: E1, open: 3_000 },
          { expenseId: E2, open: 2_000 },
          { expenseId: E3, open: 1_000 },
        ],
        [E3],
      ),
    ).toEqual([cover(E3, 1_000), cover(E1, 3_000)])
  })

  it('covers nothing when no share is open', () => {
    expect(reallocateCovers(3_000, [], [E1])).toEqual([])
  })
})

const problemOf = async (promise: Promise<unknown>) => {
  const error = await promise.catch((failure: unknown) => failure)
  expect(error).toBeInstanceOf(MockHttpError)
  return (error as MockHttpError).problem
}

const refused = async (promise: Promise<unknown>, errors: Record<string, string[]>) => {
  const problem = await problemOf(promise)
  expect(problem.status).toBe(400)
  expect(problem.errors).toEqual(errors)
}

const notFound = async (promise: Promise<unknown>) =>
  expect(await problemOf(promise)).toEqual({ status: 404, title: 'Not Found' })

const api = (): MockApi => {
  const mock = loggedInMockApi()
  Object.assign(mock.db.state, {
    groups: [],
    groupMembers: [],
    groupCategories: [],
    groupExpenses: [],
    groupRepayments: [],
    groupEvents: [],
    groupRepaymentCovers: [],
    groupConfirmations: [],
    groupConfirmationTransactions: [],
    groupLegs: [],
  })
  quoteRate(mock, 'EUR', 4.3, day(-10))
  return mock
}

const send = (mock: MockApi, method: HttpMethod, path: string, body?: unknown, headers?: Record<string, string>) =>
  mock.handle({ method, path, body, headers })

const groupPath = (groupId: string, suffix = '') => `/v1/groups/${groupId}${suffix}`

const createGroup = (mock: MockApi, name = 'Trip') =>
  send(mock, 'POST', '/v1/groups', { name, currency: 'EUR', members: ['Anna', 'Olya', 'Max'] }) as Promise<GroupDto>

const addExpense = (mock: MockApi, groupId: string, body: Record<string, unknown>) =>
  send(mock, 'POST', groupPath(groupId, '/expenses'), {
    currency: 'EUR',
    date: today,
    ...body,
  }) as Promise<GroupExpenseDto>

const setUp = async (mock: MockApi) => {
  const group = await createGroup(mock)
  const [anna, olya, max] = group.members.map((member) => member.id) as [string, string, string]
  const e1 = await addExpense(mock, group.id, { payerId: olya, amount: 9_000, date: day(-5) })
  const e2 = await addExpense(mock, group.id, { payerId: olya, amount: 6_000, date: day(-3) })
  return { group, anna, olya, max, e1: e1.id, e2: e2.id }
}

const repayment = (from: string, to: string, amount: number, ...settles: string[]) => ({
  fromMemberId: from,
  toMemberId: to,
  amount,
  currency: 'EUR',
  date: today,
  ...(settles.length > 0 ? { settles } : {}),
})

const repaymentsPath = (groupId: string, suffix = '') => groupPath(groupId, `/repayments${suffix}`)
const create = (mock: MockApi, groupId: string, body: unknown) =>
  send(mock, 'POST', repaymentsPath(groupId), body) as Promise<GroupRepaymentDto>
const edit = (mock: MockApi, groupId: string, id: string, body: unknown) =>
  send(mock, 'PUT', repaymentsPath(groupId, `/${id}`), body) as Promise<GroupRepaymentDto>
const remove = (mock: MockApi, groupId: string, id: string) => send(mock, 'DELETE', repaymentsPath(groupId, `/${id}`))
const restore = (mock: MockApi, groupId: string, id: string) =>
  send(mock, 'POST', repaymentsPath(groupId, `/${id}/restore`)) as Promise<GroupRepaymentDto>
const list = (mock: MockApi, groupId: string) =>
  send(mock, 'GET', repaymentsPath(groupId)) as Promise<Page<GroupRepaymentDto>>
const history = (mock: MockApi, groupId: string, id: string) =>
  send(mock, 'GET', repaymentsPath(groupId, `/${id}/history`)) as Promise<Page<GroupEntryEvent<GroupRepaymentState>>>
const openShares = (mock: MockApi, groupId: string) =>
  send(mock, 'GET', groupPath(groupId, '/open-shares')) as Promise<OpenShareDto[]>

const coversOf = (entry: { covers: { expenseId: string; groupAmount: number }[] }) =>
  entry.covers.map((item) => [item.expenseId, item.groupAmount])

const storedCovers = (mock: MockApi, groupId: string) =>
  mock.db.state.groupRepaymentCovers.filter((row) => row.groupId === groupId).length

const coveredPerExpense = async (mock: MockApi, groupId: string) => {
  const covered = new Map<string, number>()
  for (const item of (await list(mock, groupId)).items) {
    for (const entry of item.covers)
      covered.set(entry.expenseId, (covered.get(entry.expenseId) ?? 0) + entry.groupAmount)
  }
  return Object.fromEntries(covered)
}

const sharesOf = (rows: OpenShareDto[]) => rows.map((row) => [row.expenseId, row.share, row.open])

describe('repayment covers', () => {
  it('covers the oldest shares of the pair first', async () => {
    const mock = api()
    const trip = await setUp(mock)
    await addExpense(mock, trip.group.id, {
      payerId: trip.max,
      amount: 3_000,
      date: day(-6),
      split: { mode: 'equal', memberIds: [trip.anna, trip.max] },
    })

    const first = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 4_000))

    expect(coversOf(first)).toEqual([
      [trip.e1, 3_000],
      [trip.e2, 1_000],
    ])
    expect(Object.keys(first.covers[0] ?? {})).toEqual(['expenseId', 'groupAmount', 'description', 'categoryId'])
    expect(first.covers[0]).toEqual({ expenseId: trip.e1, groupAmount: 3_000, description: null, categoryId: 'other' })

    const second = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 2_000))

    expect(coversOf(second)).toEqual([[trip.e2, 1_000]])
    const listed = Object.fromEntries((await list(mock, trip.group.id)).items.map((item) => [item.id, coversOf(item)]))
    expect(listed[first.id]).toEqual([
      [trip.e1, 3_000],
      [trip.e2, 1_000],
    ])
    expect(listed[second.id]).toEqual([[trip.e2, 1_000]])
    expect(storedCovers(mock, trip.group.id)).toBe(3)
  })

  it('covers the requested shares first', async () => {
    const mock = api()
    const trip = await setUp(mock)

    const created = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 4_000, trip.e2))

    expect(coversOf(created)).toEqual([
      [trip.e2, 2_000],
      [trip.e1, 2_000],
    ])
    expect(coversOf((await list(mock, trip.group.id)).items[0] ?? { covers: [] })).toEqual([
      [trip.e2, 2_000],
      [trip.e1, 2_000],
    ])
  })

  it('records the covers in the history state without the expense details', async () => {
    const mock = api()
    const trip = await setUp(mock)

    const created = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 4_000))

    const [event] = (await history(mock, trip.group.id, created.id)).items
    expect(event?.state.covers).toEqual([cover(trip.e1, 3_000), cover(trip.e2, 1_000)])
    expect(Object.keys(event?.state ?? {})).toContain('covers')
  })

  it('refuses shares that are not open between the members, together with the member references', async () => {
    const mock = api()
    const trip = await setUp(mock)
    const other = await createGroup(mock, 'Other')
    const otherMembers = other.members.map((member) => member.id)
    const paidByMax = await addExpense(mock, trip.group.id, { payerId: trip.max, amount: 3_000 })
    const withoutAnna = await addExpense(mock, trip.group.id, {
      payerId: trip.olya,
      amount: 3_000,
      split: { mode: 'equal', memberIds: [trip.olya, trip.max] },
    })
    const deleted = await addExpense(mock, trip.group.id, { payerId: trip.olya, amount: 3_000 })
    await send(mock, 'DELETE', groupPath(trip.group.id, `/expenses/${deleted.id}`))
    const foreign = await addExpense(mock, other.id, { payerId: otherMembers[1], amount: 3_000 })

    for (const expenseId of [paidByMax.id, withoutAnna.id, deleted.id, foreign.id, 'gex_missing']) {
      await refused(create(mock, trip.group.id, repayment(trip.anna, trip.olya, 4_000, trip.e1, expenseId)), {
        settles: ['validation.unknownShare'],
      })
    }
    await refused(create(mock, trip.group.id, repayment(trip.anna, otherMembers[1] as string, 4_000, trip.e1)), {
      toMemberId: ['validation.unknownMember'],
      settles: ['validation.unknownShare'],
    })

    expect((await list(mock, trip.group.id)).total).toBe(0)
    expect(storedCovers(mock, trip.group.id)).toBe(0)
  })

  it.each([
    ['a string', 'x'],
    ['a blank string', ''],
    ['a number', 5],
    ['an object', {}],
    ['an element that is not a string', [5]],
    ['a blank element', ['  ']],
    ['a repeat', [E1, E1]],
    ['a repeat with spaces', [E1, ` ${E1} `]],
    ['more than 50 ids', Array.from({ length: 51 }, (_, index) => `gex_${index}`)],
  ])('refuses settles that is %s before the group is looked up', async (_name, settles) => {
    const mock = api()
    const trip = await setUp(mock)
    const body = { ...repayment(trip.anna, trip.olya, 1_000), settles }

    await refused(create(mock, trip.group.id, body), { settles: ['validation.invalidValue'] })
    await refused(create(mock, 'grp_missing', body), { settles: ['validation.invalidValue'] })
  })

  it('takes a missing or null settles and up to 50 ids', async () => {
    const mock = api()
    const trip = await setUp(mock)

    expect(
      coversOf(await create(mock, trip.group.id, { ...repayment(trip.anna, trip.olya, 1_000), settles: null })),
    ).toEqual([[trip.e1, 1_000]])
    await refused(
      create(mock, trip.group.id, {
        ...repayment(trip.anna, trip.olya, 1_000),
        settles: Array.from({ length: 50 }, (_, index) => `gex_${index}`),
      }),
      { settles: ['validation.unknownShare'] },
    )
  })

  it('refuses settles when the share is fully covered, but counts the own covers as open on edit', async () => {
    const mock = api()
    const trip = await setUp(mock)
    await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 2_000))
    const partial = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 1_000, trip.e1))

    expect(coversOf(partial)).toEqual([[trip.e1, 1_000]])

    await refused(create(mock, trip.group.id, repayment(trip.anna, trip.olya, 500, trip.e1)), {
      settles: ['validation.unknownShare'],
    })
    expect((await list(mock, trip.group.id)).total).toBe(2)

    const edited = await edit(mock, trip.group.id, partial.id, repayment(trip.anna, trip.olya, 1_000, trip.e1))

    expect(coversOf(edited)).toEqual([[trip.e1, 1_000]])
    expect(storedCovers(mock, trip.group.id)).toBe(2)
  })

  it('drops an own cover that is no longer open when edited, and refuses an unrelated covered share', async () => {
    const mock = api()
    const trip = await setUp(mock)
    const created = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 2_000, trip.e1))
    expect(coversOf(created)).toEqual([[trip.e1, 2_000]])
    await send(mock, 'DELETE', groupPath(trip.group.id, `/expenses/${trip.e1}`))

    const edited = await edit(mock, trip.group.id, created.id, {
      ...repayment(trip.anna, trip.olya, 2_000, trip.e1),
      note: 'Cash',
    })

    expect(coversOf(edited)).toEqual([[trip.e2, 2_000]])
    expect(edited.note).toBe('Cash')
    expect(storedCovers(mock, trip.group.id)).toBe(1)

    const other = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 1_000))
    expect(other.covers).toEqual([])

    await refused(edit(mock, trip.group.id, other.id, repayment(trip.anna, trip.olya, 1_000, trip.e2)), {
      settles: ['validation.unknownShare'],
    })
  })

  it('leaves the repayment uncovered when every covered share is gone, also when restored', async () => {
    const mock = api()
    const trip = await setUp(mock)
    const created = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 2_000, trip.e1))
    await send(mock, 'DELETE', groupPath(trip.group.id, `/expenses/${trip.e1}`))
    await send(mock, 'DELETE', groupPath(trip.group.id, `/expenses/${trip.e2}`))

    const edited = await edit(mock, trip.group.id, created.id, repayment(trip.anna, trip.olya, 2_000, trip.e1))

    expect(edited.covers).toEqual([])
    expect(storedCovers(mock, trip.group.id)).toBe(0)

    await send(mock, 'POST', groupPath(trip.group.id, `/expenses/${trip.e2}/restore`))
    await remove(mock, trip.group.id, created.id)
    await send(mock, 'DELETE', groupPath(trip.group.id, `/expenses/${trip.e2}`))

    expect((await restore(mock, trip.group.id, created.id)).covers).toEqual([])
  })

  it('covers the requested shares first when edited and keeps the earlier covers in the history', async () => {
    const mock = api()
    const trip = await setUp(mock)
    const created = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 4_000))

    const edited = await edit(mock, trip.group.id, created.id, repayment(trip.anna, trip.olya, 4_000, trip.e2))

    expect(coversOf(edited)).toEqual([
      [trip.e2, 2_000],
      [trip.e1, 2_000],
    ])
    const events = (await history(mock, trip.group.id, created.id)).items
    expect(coversOf(events[0]?.state ?? { covers: [] })).toEqual([
      [trip.e2, 2_000],
      [trip.e1, 2_000],
    ])
    expect(coversOf(events[1]?.state ?? { covers: [] })).toEqual([
      [trip.e1, 3_000],
      [trip.e2, 1_000],
    ])
    expect(storedCovers(mock, trip.group.id)).toBe(2)
  })

  it('covers the requested shares through the share link', async () => {
    const mock = api()
    const trip = await setUp(mock)
    const token = ((await send(mock, 'POST', groupPath(trip.group.id, '/share'))) as GroupDto).shareToken as string
    const asAnna = { [GROUP_MEMBER_HEADER]: trip.anna }
    const linkRepayments = `/v1/shared/groups/${token}/repayments`

    const created = (await send(
      mock,
      'POST',
      linkRepayments,
      repayment(trip.anna, trip.olya, 2_000, trip.e2),
      asAnna,
    )) as GroupRepaymentDto
    expect(coversOf(created)).toEqual([[trip.e2, 2_000]])

    const edited = (await send(
      mock,
      'PUT',
      `${linkRepayments}/${created.id}`,
      repayment(trip.anna, trip.olya, 4_000, trip.e2),
      asAnna,
    )) as GroupRepaymentDto
    expect(coversOf(edited)).toEqual([
      [trip.e2, 2_000],
      [trip.e1, 2_000],
    ])

    await refused(send(mock, 'POST', linkRepayments, repayment(trip.anna, trip.olya, 1_000, trip.e2), asAnna), {
      settles: ['validation.unknownShare'],
    })
    expect(storedCovers(mock, trip.group.id)).toBe(2)
  })

  it('covers only what is still open when restored after another repayment covered it', async () => {
    const mock = api()
    const trip = await setUp(mock)
    const first = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 3_000))
    expect(coversOf(first)).toEqual([[trip.e1, 3_000]])
    await remove(mock, trip.group.id, first.id)
    const second = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 3_000))
    expect(coversOf(second)).toEqual([[trip.e1, 3_000]])

    const restored = await restore(mock, trip.group.id, first.id)

    expect(coversOf(restored)).toEqual([[trip.e2, 2_000]])
    expect(await coveredPerExpense(mock, trip.group.id)).toEqual({ [trip.e1]: 3_000, [trip.e2]: 2_000 })
    await send(mock, 'PUT', groupPath(trip.group.id, `/members/${trip.anna}/link`))
    expect(await openShares(mock, trip.group.id)).toEqual([])
    const events = (await history(mock, trip.group.id, first.id)).items
    expect(events.map((event) => event.action)).toEqual(['restored', 'deleted', 'created'])
    expect(coversOf(events[0]?.state ?? { covers: [] })).toEqual([[trip.e2, 2_000]])
    expect(coversOf(events[1]?.state ?? { covers: [] })).toEqual([[trip.e1, 3_000]])

    await remove(mock, trip.group.id, first.id)
    const third = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 2_000))
    expect(coversOf(third)).toEqual([[trip.e2, 2_000]])

    const restoredAgain = await restore(mock, trip.group.id, first.id)

    expect(restoredAgain.covers).toEqual([])
    expect(await coveredPerExpense(mock, trip.group.id)).toEqual({ [trip.e1]: 3_000, [trip.e2]: 2_000 })
    expect(storedCovers(mock, trip.group.id)).toBe(2)
  })

  it('keeps the covers when restored with nothing taken meanwhile', async () => {
    const mock = api()
    const trip = await setUp(mock)
    const created = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 4_000, trip.e2))
    await remove(mock, trip.group.id, created.id)

    const restored = await restore(mock, trip.group.id, created.id)

    expect(coversOf(restored)).toEqual([
      [trip.e2, 2_000],
      [trip.e1, 2_000],
    ])
    expect(coversOf((await history(mock, trip.group.id, created.id)).items[0]?.state ?? { covers: [] })).toEqual([
      [trip.e2, 2_000],
      [trip.e1, 2_000],
    ])
  })

  it('covers the oldest shares first when a repayment without covers is restored', async () => {
    const mock = api()
    const trip = await setUp(mock)
    const removed = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 4_000))
    await remove(mock, trip.group.id, removed.id)
    mock.db.state.groupRepaymentCovers = []

    const restored = await restore(mock, trip.group.id, removed.id)

    expect(coversOf(restored)).toEqual([
      [trip.e1, 3_000],
      [trip.e2, 1_000],
    ])
    expect(storedCovers(mock, trip.group.id)).toBe(2)
  })

  it('allocates the covers again only on edit and restore, never on delete or expense changes', async () => {
    const mock = api()
    const trip = await setUp(mock)
    await send(mock, 'PUT', groupPath(trip.group.id, `/members/${trip.anna}/link`))
    const created = await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 4_000))

    const edited = await edit(mock, trip.group.id, created.id, repayment(trip.anna, trip.olya, 2_000))

    expect(coversOf(edited)).toEqual([[trip.e1, 2_000]])
    expect(storedCovers(mock, trip.group.id)).toBe(1)

    await remove(mock, trip.group.id, created.id)

    expect(storedCovers(mock, trip.group.id)).toBe(1)
    expect(sharesOf(await openShares(mock, trip.group.id))).toEqual([
      [trip.e1, 3_000, 3_000],
      [trip.e2, 2_000, 2_000],
    ])

    expect(coversOf(await restore(mock, trip.group.id, created.id))).toEqual([[trip.e1, 2_000]])

    await send(mock, 'PUT', groupPath(trip.group.id, `/expenses/${trip.e1}`), {
      payerId: trip.olya,
      amount: 12_000,
      currency: 'EUR',
      date: day(-5),
      categoryId: 'groceries',
      description: 'Market',
    })

    const [listed] = (await list(mock, trip.group.id)).items
    expect(listed?.covers).toEqual([
      { expenseId: trip.e1, groupAmount: 2_000, description: 'Market', categoryId: 'groceries' },
    ])
    expect(sharesOf(await openShares(mock, trip.group.id))).toEqual([
      [trip.e1, 4_000, 2_000],
      [trip.e2, 2_000, 2_000],
    ])
    const events = (await history(mock, trip.group.id, created.id)).items
    expect(events.map((event) => event.action)).toEqual(['restored', 'deleted', 'updated', 'created'])
    for (const event of events.slice(0, 3)) expect(coversOf(event.state)).toEqual([[trip.e1, 2_000]])
    expect(coversOf(events[3]?.state ?? { covers: [] })).toEqual([
      [trip.e1, 3_000],
      [trip.e2, 1_000],
    ])
    for (const event of events) {
      for (const entry of event.state.covers) expect(Object.keys(entry)).toEqual(['expenseId', 'groupAmount'])
    }
  })

  it('removes the covers with the group', async () => {
    const mock = api()
    const trip = await setUp(mock)
    await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 4_000))

    await send(mock, 'DELETE', groupPath(trip.group.id))

    expect(mock.db.state.groupRepaymentCovers).toEqual([])
  })
})

describe('open shares', () => {
  it("lists the open shares of the caller's member, oldest first, and nothing to an owner who is not linked", async () => {
    const mock = api()
    const trip = await setUp(mock)
    const member = mock.db.state.groupMembers.find((row) => row.id === trip.anna)
    if (member) member.userId = 'usr_oleh'
    await addExpense(mock, trip.group.id, { payerId: trip.anna, amount: 3_000, date: day(-4) })
    mock.db.state.activeUserId = 'usr_oleh'

    const before = await openShares(mock, trip.group.id)

    expect(sharesOf(before)).toEqual([
      [trip.e1, 3_000, 3_000],
      [trip.e2, 2_000, 2_000],
    ])
    expect(Object.keys(before[0] ?? {})).toEqual([
      'expenseId',
      'payerId',
      'date',
      'description',
      'categoryId',
      'share',
      'open',
    ])
    expect(before[0]).toMatchObject({ payerId: trip.olya, date: day(-5), description: null, categoryId: 'other' })

    mock.db.state.activeUserId = 'usr_anna'
    await create(mock, trip.group.id, repayment(trip.anna, trip.olya, 4_000))

    expect(await openShares(mock, trip.group.id)).toEqual([])
    mock.db.state.activeUserId = 'usr_oleh'
    expect(sharesOf(await openShares(mock, trip.group.id))).toEqual([[trip.e2, 2_000, 1_000]])
  })

  it('answers 404 for a group the caller cannot open and has no share link counterpart', async () => {
    const mock = api()
    const trip = await setUp(mock)
    const token = ((await send(mock, 'POST', groupPath(trip.group.id, '/share'))) as GroupDto).shareToken as string

    await notFound(openShares(mock, 'grp_missing'))
    await notFound(send(mock, 'GET', `/v1/shared/groups/${token}/open-shares`))
    mock.db.state.activeUserId = 'usr_oleh'
    await notFound(openShares(mock, trip.group.id))
  })
})
