import { describe, expect, it } from 'bun:test'
import type {
  GroupBalancesDto,
  GroupDto,
  GroupEntryEvent,
  GroupExpenseDto,
  GroupRepaymentDto,
  GroupRepaymentState,
  Page,
} from '../../../app/shared/api/contract'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import type { MockApi } from '../../../mocks/api'
import { MockHttpError } from '../../../mocks/errors'
import { settle } from '../../../mocks/groups'
import { oneYearAhead } from '../../../mocks/handlers/transfers'
import { loggedInMockApi, quoteRate } from './session'

const today = todayIso()
const day = (offset: number) => addDaysIso(today, offset)
const rateDay = day(-3)

const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)

const problemOf = async (promise: Promise<unknown>) => {
  const error = await failure(promise)
  expect(error).toBeInstanceOf(MockHttpError)
  return (error as MockHttpError).problem
}

const refused = async (promise: Promise<unknown>, errors: Record<string, string[]>) => {
  const problem = await problemOf(promise)
  expect(problem.status).toBe(400)
  expect(problem.errors).toEqual(errors)
}

const unavailable = async (promise: Promise<unknown>) =>
  expect(await problemOf(promise)).toMatchObject({ status: 503, code: 'rates.unavailable' })

const notFound = async (promise: Promise<unknown>) => expect((await problemOf(promise)).status).toBe(404)

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
  quoteRate(mock, 'ALL', 0.044, rateDay)
  quoteRate(mock, 'EUR', 4.3, rateDay)
  quoteRate(mock, 'JPY', 0.024764, rateDay)
  return mock
}

const ISO_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const owner = { kind: 'owner', memberId: null, name: 'Anna Nowak' }

const stateKeys = [
  'amount',
  'currency',
  'date',
  'fromMemberId',
  'groupAmount',
  'note',
  'rate',
  'rateManual',
  'toMemberId',
]

const repaymentKeys = [...stateKeys, 'createdAt', 'createdBy', 'deleted', 'id', 'updatedAt', 'updatedBy'].sort()

const createGroup = (mock: MockApi, patch: Record<string, unknown> = {}) =>
  mock.handle({
    method: 'POST',
    path: '/v1/groups',
    body: { name: 'Trip', currency: 'EUR', members: ['Anna', 'Olya', 'Max'], ...patch },
  }) as Promise<GroupDto>
const getGroup = (mock: MockApi, id: string) =>
  mock.handle({ method: 'GET', path: `/v1/groups/${id}` }) as Promise<GroupDto>
const updateGroup = (mock: MockApi, id: string, body: unknown) =>
  mock.handle({ method: 'PUT', path: `/v1/groups/${id}`, body }) as Promise<GroupDto>
const deleteGroup = (mock: MockApi, id: string) => mock.handle({ method: 'DELETE', path: `/v1/groups/${id}` })
const removeMember = (mock: MockApi, id: string, memberId: string) =>
  mock.handle({ method: 'DELETE', path: `/v1/groups/${id}/members/${memberId}` })

const expensesPath = (groupId: string) => `/v1/groups/${groupId}/expenses`
const addExpense = (mock: MockApi, groupId: string, body: unknown) =>
  mock.handle({ method: 'POST', path: expensesPath(groupId), body }) as Promise<GroupExpenseDto>
const deleteExpense = (mock: MockApi, groupId: string, expenseId: string) =>
  mock.handle({ method: 'DELETE', path: `${expensesPath(groupId)}/${expenseId}` })
const restoreExpense = (mock: MockApi, groupId: string, expenseId: string) =>
  mock.handle({ method: 'POST', path: `${expensesPath(groupId)}/${expenseId}/restore` }) as Promise<GroupExpenseDto>

const repaymentsPath = (groupId: string) => `/v1/groups/${groupId}/repayments`
const addRepayment = (mock: MockApi, groupId: string, body: unknown) =>
  mock.handle({ method: 'POST', path: repaymentsPath(groupId), body }) as Promise<GroupRepaymentDto>
const editRepayment = (mock: MockApi, groupId: string, repaymentId: string, body: unknown) =>
  mock.handle({
    method: 'PUT',
    path: `${repaymentsPath(groupId)}/${repaymentId}`,
    body,
  }) as Promise<GroupRepaymentDto>
const deleteRepayment = (mock: MockApi, groupId: string, repaymentId: string) =>
  mock.handle({ method: 'DELETE', path: `${repaymentsPath(groupId)}/${repaymentId}` })
const restoreRepayment = (mock: MockApi, groupId: string, repaymentId: string) =>
  mock.handle({
    method: 'POST',
    path: `${repaymentsPath(groupId)}/${repaymentId}/restore`,
  }) as Promise<GroupRepaymentDto>
const listRepayments = (mock: MockApi, groupId: string, query: Record<string, string> = {}) =>
  mock.handle({ method: 'GET', path: repaymentsPath(groupId), query }) as Promise<Page<GroupRepaymentDto>>
const history = (mock: MockApi, groupId: string, repaymentId: string, query: Record<string, string> = {}) =>
  mock.handle({
    method: 'GET',
    path: `${repaymentsPath(groupId)}/${repaymentId}/history`,
    query,
  }) as Promise<Page<GroupEntryEvent<GroupRepaymentState>>>
const balances = (mock: MockApi, groupId: string, query: Record<string, string> = {}) =>
  mock.handle({ method: 'GET', path: `/v1/groups/${groupId}/balances`, query }) as Promise<GroupBalancesDto>

const trip = async (mock: MockApi, patch: Record<string, unknown> = {}) => {
  const group = await createGroup(mock, patch)
  const [anna, olya, max] = group.members.map((member) => member.id) as [string, string, string]
  return { group, anna, olya, max }
}

const eur = (from: string, to: string, amount: number, extra: Record<string, unknown> = {}) => ({
  fromMemberId: from,
  toMemberId: to,
  amount,
  currency: 'EUR',
  date: today,
  ...extra,
})

const figures = (page: GroupBalancesDto) =>
  page.members.map(({ paid, share, sent, received, balance }) => [paid, share, sent, received, balance])

const transfersOf = (page: GroupBalancesDto) =>
  page.transfers.map(({ fromMemberId, toMemberId, amount }) => [fromMemberId, toMemberId, amount])

describe('group repayments', () => {
  it('records a repayment between two members', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)

    const created = await addRepayment(mock, group.id, eur(max, anna, 2_000))

    expect(Object.keys(created).sort()).toEqual(repaymentKeys)
    expect(created.id).toStartWith('gpay_')
    expect(created).toMatchObject({
      fromMemberId: max,
      toMemberId: anna,
      amount: 2_000,
      currency: 'EUR',
      date: today,
      rate: 1,
      rateManual: false,
      groupAmount: 2_000,
      note: null,
      deleted: false,
      createdBy: owner,
      updatedBy: null,
      updatedAt: null,
    })
    expect(created.createdAt).toMatch(ISO_MILLISECONDS)
    const read = await getGroup(mock, group.id)
    expect(read.members.map((member) => [member.id, member.inUse])).toEqual([
      [anna, true],
      [olya, false],
      [max, true],
    ])
    expect(read).toMatchObject({ currencyLocked: true, total: 0 })
    expect(mock.db.state.groupEvents).toHaveLength(1)
    expect(mock.db.state.groupEvents[0]).toMatchObject({
      kind: 'repayment',
      entryId: created.id,
      action: 'created',
      actorUserId: 'usr_anna',
      actorMemberId: null,
    })
  })

  it('locks the main currency once a repayment exists', async () => {
    const mock = api()
    const { group, anna, max } = await trip(mock)
    await addRepayment(mock, group.id, eur(max, anna, 2_000))

    await refused(updateGroup(mock, group.id, { name: 'Trip', currency: 'PLN' }), {
      currency: ['validation.groupCurrencyLocked'],
    })
    expect(await updateGroup(mock, group.id, { name: 'Trip', currency: 'EUR' })).toMatchObject({ currency: 'EUR' })
  })

  it('stores the trimmed note and leaves it null when blank', async () => {
    const mock = api()
    const { group, anna, max } = await trip(mock)

    const noted = await addRepayment(mock, group.id, eur(max, anna, 2_000, { note: '  cash at the pier ' }))
    const blank = await addRepayment(mock, group.id, eur(max, anna, 2_000, { note: '   ' }))
    const longest = await addRepayment(mock, group.id, eur(max, anna, 2_000, { note: 'n'.repeat(200) }))

    expect(noted.note).toBe('cash at the pier')
    expect(blank.note).toBeNull()
    expect(longest.note).toHaveLength(200)
  })

  it('converts at the rate of the date into the main currency, or at a manual rate', async () => {
    const mock = api()
    const { group, anna, max } = await trip(mock)
    const body = { fromMemberId: max, toMemberId: anna, amount: 10_000, currency: 'PLN', date: rateDay }

    expect(await addRepayment(mock, group.id, body)).toMatchObject({
      rate: 0.232558,
      rateManual: false,
      groupAmount: 2_326,
    })
    expect(await addRepayment(mock, group.id, { ...body, rate: 0.25 })).toMatchObject({
      rate: 0.25,
      rateManual: true,
      groupAmount: 2_500,
    })
    expect(await addRepayment(mock, group.id, eur(max, anna, 5_000, { date: rateDay, rate: 9 }))).toMatchObject({
      rate: 1,
      rateManual: false,
      groupAmount: 5_000,
    })
    expect(await addRepayment(mock, group.id, { ...body, rate: '  ' })).toMatchObject({
      rateManual: false,
      groupAmount: 2_326,
    })
  })

  it('refuses a stale rate and writes nothing, but takes a manual rate', async () => {
    const mock = api()
    quoteRate(mock, 'EUR', 4.3, day(-40))
    const { group, anna, max } = await trip(mock)
    const body = { fromMemberId: max, toMemberId: anna, amount: 10_000, currency: 'PLN', date: today }

    await unavailable(addRepayment(mock, group.id, body))

    expect(mock.db.state.groupRepayments).toHaveLength(0)
    expect(mock.db.state.groupEvents).toHaveLength(0)
    expect(await addRepayment(mock, group.id, { ...body, rate: 0.25 })).toMatchObject({ groupAmount: 2_500 })
  })

  it('refuses a converted amount that rounds to zero or is too large', async () => {
    const mock = api()
    const { group, anna, max } = await trip(mock)
    const body = { fromMemberId: max, toMemberId: anna, currency: 'PLN', date: today }

    await refused(addRepayment(mock, group.id, { ...body, amount: 1, rate: 0.001 }), {
      rate: ['validation.positiveAmount'],
    })
    await refused(addRepayment(mock, group.id, { ...body, amount: 100_000_000_000, rate: 2 }), {
      rate: ['validation.invalidValue'],
    })
    expect(mock.db.state.groupRepayments).toHaveLength(0)
  })

  it('reports every invalid field of the body in one answer', async () => {
    const mock = api()
    const { group } = await trip(mock)

    await refused(addRepayment(mock, group.id, {}), {
      fromMemberId: ['validation.required'],
      toMemberId: ['validation.required'],
      amount: ['validation.required'],
      currency: ['validation.required'],
      date: ['validation.required'],
    })
    await refused(
      addRepayment(mock, group.id, {
        fromMemberId: ' ',
        toMemberId: null,
        amount: null,
        currency: '',
        date: '  ',
      }),
      {
        fromMemberId: ['validation.required'],
        toMemberId: ['validation.required'],
        amount: ['validation.required'],
        currency: ['validation.required'],
        date: ['validation.required'],
      },
    )
    await refused(
      addRepayment(mock, group.id, {
        fromMemberId: 5,
        toMemberId: [],
        amount: 0,
        currency: 'XDR',
        date: 'not-a-date',
        rate: 0,
        note: 'x'.repeat(201),
      }),
      {
        fromMemberId: ['validation.unknownMember'],
        toMemberId: ['validation.unknownMember'],
        amount: ['validation.positiveAmount'],
        currency: ['validation.invalidValue'],
        date: ['validation.invalidValue'],
        rate: ['validation.invalidValue'],
        note: ['validation.noteTooLong'],
      },
    )
    await refused(
      addRepayment(mock, group.id, {
        fromMemberId: 'a',
        toMemberId: 'a',
        amount: 100_000_000_001,
        currency: 'EUR',
        date: oneYearAhead(addDaysIso(today, 1)),
        rate: 1_000_000_001,
        note: 'tab\there',
      }),
      {
        toMemberId: ['validation.sameMember'],
        amount: ['validation.invalidValue'],
        date: ['validation.dateTooFar'],
        rate: ['validation.invalidValue'],
        note: ['validation.invalidValue'],
      },
    )
    await refused(addRepayment(mock, group.id, { ...eur('a', 'b', 1_000), amount: 1.5, note: 7 }), {
      amount: ['validation.invalidValue'],
      note: ['validation.invalidValue'],
    })
    expect(mock.db.state.groupRepayments).toHaveLength(0)
  })

  it('refuses the same member on both sides, also with padded ids', async () => {
    const mock = api()
    const { group, olya } = await trip(mock)

    await refused(addRepayment(mock, group.id, eur(olya, olya, 1_000)), {
      toMemberId: ['validation.sameMember'],
    })
    await refused(addRepayment(mock, group.id, eur(olya, ` ${olya} `, 1_000)), {
      toMemberId: ['validation.sameMember'],
    })
    expect(mock.db.state.groupRepayments).toHaveLength(0)
  })

  it('reports members outside the group together and before any rate', async () => {
    const mock = api()
    quoteRate(mock, 'EUR', 4.3, day(-40))
    const { group, anna } = await trip(mock)
    const other = await trip(mock, { name: 'Other' })

    await refused(addRepayment(mock, group.id, eur(other.anna, other.olya, 1_000)), {
      fromMemberId: ['validation.unknownMember'],
      toMemberId: ['validation.unknownMember'],
    })
    await refused(addRepayment(mock, group.id, eur(anna, other.olya, 1_000)), {
      toMemberId: ['validation.unknownMember'],
    })
    await refused(
      addRepayment(mock, group.id, {
        fromMemberId: anna,
        toMemberId: 'mbr_missing',
        amount: 10_000,
        currency: 'PLN',
        date: today,
      }),
      { toMemberId: ['validation.unknownMember'] },
    )
    expect(mock.db.state.groupRepayments).toHaveLength(0)
    expect(mock.db.state.groupEvents).toHaveLength(0)
  })

  it('updates, deletes and restores a repayment and records every change', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    const created = await addRepayment(mock, group.id, eur(max, anna, 2_000))

    const updated = await editRepayment(mock, group.id, created.id, eur(olya, anna, 2_500, { note: ' cash ' }))

    expect(updated).toMatchObject({
      id: created.id,
      fromMemberId: olya,
      toMemberId: anna,
      amount: 2_500,
      groupAmount: 2_500,
      note: 'cash',
    })
    expect(updated.createdBy).toEqual(created.createdBy)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedBy).toEqual(owner)
    expect(updated.updatedAt).toMatch(ISO_MILLISECONDS)

    expect(await deleteRepayment(mock, group.id, created.id)).toBeUndefined()
    expect((await listRepayments(mock, group.id)).total).toBe(0)
    const removed = await listRepayments(mock, group.id, { deleted: 'true' })
    expect(removed.items.map((item) => [item.id, item.deleted])).toEqual([[created.id, true]])
    expect(removed.items[0]?.updatedBy).toEqual(owner)
    await notFound(editRepayment(mock, group.id, created.id, eur(max, anna, 1_000)))
    await notFound(deleteRepayment(mock, group.id, created.id))

    const restored = await restoreRepayment(mock, group.id, created.id)

    expect(restored).toEqual({ ...updated, updatedAt: restored.updatedAt })
    expect((await listRepayments(mock, group.id)).total).toBe(1)
    await notFound(restoreRepayment(mock, group.id, created.id))

    const events = await history(mock, group.id, created.id)
    expect(events).toMatchObject({ page: 1, pageSize: 100, total: 4 })
    expect(events.items.map((event) => event.action)).toEqual(['restored', 'deleted', 'updated', 'created'])
    for (const event of events.items) {
      expect(Object.keys(event).sort()).toEqual(['action', 'actor', 'at', 'id', 'state'])
      expect(Object.keys(event.state).sort()).toEqual(stateKeys)
      expect(event.actor).toEqual(owner)
      expect(event.at).toMatch(ISO_MILLISECONDS)
    }
    const [restoredState, deletedState, updatedState, createdState] = events.items.map((event) => event.state)
    expect(restoredState).toEqual(updatedState)
    expect(deletedState).toEqual(updatedState)
    expect(updatedState).toMatchObject({ amount: 2_500, fromMemberId: olya, note: 'cash' })
    expect(createdState).toMatchObject({ amount: 2_000, fromMemberId: max, note: null })
    expect((await history(mock, group.id, created.id, { pageSize: '1' })).items.map((event) => event.action)).toEqual([
      'restored',
    ])
  })

  it('keeps the history of a deleted repayment readable', async () => {
    const mock = api()
    const { group, anna, max } = await trip(mock)
    const created = await addRepayment(mock, group.id, eur(max, anna, 2_000))
    await deleteRepayment(mock, group.id, created.id)

    const events = await history(mock, group.id, created.id)

    expect(events.items.map((event) => event.action)).toEqual(['deleted', 'created'])
  })

  it('prices an edit again at the rate of its date unless a manual rate is sent', async () => {
    const mock = api()
    quoteRate(mock, 'EUR', 4, day(-10))
    const { group, anna, olya } = await trip(mock)
    const body = { fromMemberId: olya, toMemberId: anna, amount: 10_000, currency: 'PLN', date: day(-10) }
    const created = await addRepayment(mock, group.id, body)
    expect(created).toMatchObject({ rate: 0.25, groupAmount: 2_500 })
    mock.db.state.rates = [...mock.db.state.rates, { date: day(-3), from: 'EUR', to: 'PLN', value: 5 }]

    expect(await editRepayment(mock, group.id, created.id, { ...body, date: day(-3) })).toMatchObject({
      rate: 0.2,
      rateManual: false,
      groupAmount: 2_000,
    })
    expect(await editRepayment(mock, group.id, created.id, { ...body, date: day(-3), rate: 0.3 })).toMatchObject({
      rate: 0.3,
      rateManual: true,
      groupAmount: 3_000,
    })
    expect(await editRepayment(mock, group.id, created.id, { ...body, date: day(-3) })).toMatchObject({
      rate: 0.2,
      rateManual: false,
      groupAmount: 2_000,
    })
    quoteRate(mock, 'EUR', 5, day(-40))
    await unavailable(editRepayment(mock, group.id, created.id, { ...body, date: today }))
  })

  it('refuses members of another group when a repayment is edited and keeps the stored one', async () => {
    const mock = api()
    const { group, anna, max } = await trip(mock)
    const other = await trip(mock, { name: 'Other' })
    const created = await addRepayment(mock, group.id, eur(max, anna, 2_000))

    await refused(editRepayment(mock, group.id, created.id, eur(other.anna, anna, 3_000)), {
      fromMemberId: ['validation.unknownMember'],
    })

    expect((await listRepayments(mock, group.id)).items[0]).toMatchObject({ amount: 2_000, updatedBy: null })
    expect((await history(mock, group.id, created.id)).total).toBe(1)
  })

  it('keeps a member in use when its repayment is deleted', async () => {
    const mock = api()
    const { group, anna, max } = await trip(mock)
    const created = await addRepayment(mock, group.id, eur(max, anna, 2_000))
    await deleteRepayment(mock, group.id, created.id)

    await refused(removeMember(mock, group.id, max), { memberId: ['validation.memberInUse'] })
    expect((await getGroup(mock, group.id)).currencyLocked).toBe(true)
  })

  it('keeps a member in use when only an earlier state of a repayment names it', async () => {
    const mock = api()
    const group = await createGroup(mock, { members: ['Anna', 'Olya', 'Max', 'Kasia'] })
    const [anna, olya, max, kasia] = group.members.map((member) => member.id) as [string, string, string, string]
    const created = await addRepayment(mock, group.id, eur(kasia, max, 2_000))

    await editRepayment(mock, group.id, created.id, eur(anna, olya, 2_000))

    expect((await getGroup(mock, group.id)).members.map((member) => member.inUse)).toEqual([true, true, true, true])
    await refused(removeMember(mock, group.id, max), { memberId: ['validation.memberInUse'] })
    await refused(removeMember(mock, group.id, kasia), { memberId: ['validation.memberInUse'] })
    expect((await getGroup(mock, group.id)).members).toHaveLength(4)
  })

  it('lists live and deleted repayments newest first', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    const add = (from: string, to: string, amount: number, date: string) =>
      addRepayment(mock, group.id, eur(from, to, amount, { date }))
    const oldest = await add(max, anna, 1_000, day(-3))
    const newest = await add(olya, anna, 3_000, day(-1))
    const middle = await add(max, olya, 2_000, day(-2))
    const sameDay = await add(max, anna, 2_500, day(-2))
    const removed = await add(anna, max, 4_000, today)
    await deleteRepayment(mock, group.id, removed.id)

    const live = await listRepayments(mock, group.id)

    expect(live).toMatchObject({ page: 1, pageSize: 100, total: 4 })
    expect(live.items.map((item) => item.id)).toEqual([newest.id, sameDay.id, middle.id, oldest.id])
    expect(live.items.every((item) => !item.deleted)).toBe(true)
    expect((await listRepayments(mock, group.id, { deleted: 'false' })).total).toBe(4)
    const deleted = await listRepayments(mock, group.id, { deleted: 'true' })
    expect(deleted.items.map((item) => item.id)).toEqual([removed.id])
    expect(deleted.items[0]?.deleted).toBe(true)
    expect((await listRepayments(mock, group.id, { pageSize: '2' })).items.map((item) => item.id)).toEqual([
      newest.id,
      sameDay.id,
    ])
  })

  it('reports the deleted flag together with the paging errors, before the group is looked up', async () => {
    const mock = api()
    const { group } = await trip(mock)
    const invalid = 'validation.invalidValue'

    await refused(listRepayments(mock, group.id, { deleted: 'yes' }), { deleted: [invalid] })
    await refused(listRepayments(mock, group.id, { deleted: 'True' }), { deleted: [invalid] })
    await refused(listRepayments(mock, group.id, { deleted: '' }), { deleted: [invalid] })
    await refused(listRepayments(mock, group.id, { deleted: 'yes', page: '0' }), {
      page: [invalid],
      deleted: [invalid],
    })
    await refused(listRepayments(mock, group.id, { deleted: 'yes', page: '0', pageSize: '101' }), {
      page: [invalid],
      pageSize: [invalid],
      deleted: [invalid],
    })
    await refused(listRepayments(mock, 'grp_missing', { deleted: 'x', pageSize: '0' }), {
      pageSize: [invalid],
      deleted: [invalid],
    })
    await refused(history(mock, 'grp_missing', 'gpay_missing', { page: 'x' }), { page: [invalid] })
  })

  it("answers 404 for another user's group and for a repayment of another group", async () => {
    const mock = api()
    const { group, anna, max } = await trip(mock)
    const repayment = await addRepayment(mock, group.id, eur(max, anna, 1_000))
    const other = await trip(mock, { name: 'Other' })
    const otherRepayment = await addRepayment(mock, other.group.id, eur(other.max, other.anna, 1_000))
    const body = eur(max, anna, 1_000)

    await notFound(editRepayment(mock, group.id, otherRepayment.id, body))
    await notFound(deleteRepayment(mock, group.id, otherRepayment.id))
    await notFound(restoreRepayment(mock, group.id, otherRepayment.id))
    await notFound(history(mock, group.id, otherRepayment.id))
    await notFound(editRepayment(mock, group.id, 'gpay_missing', body))
    await notFound(deleteRepayment(mock, group.id, 'gpay_missing'))
    await notFound(restoreRepayment(mock, group.id, repayment.id))
    await notFound(history(mock, group.id, 'gpay_missing'))
    await notFound(addRepayment(mock, 'grp_missing', body))
    await notFound(listRepayments(mock, 'grp_missing'))
    await notFound(balances(mock, 'grp_missing'))

    mock.db.state.activeUserId = 'usr_oleh'
    await notFound(listRepayments(mock, group.id))
    await notFound(addRepayment(mock, group.id, body))
    await notFound(editRepayment(mock, group.id, repayment.id, body))
    await notFound(deleteRepayment(mock, group.id, repayment.id))
    await notFound(restoreRepayment(mock, group.id, repayment.id))
    await notFound(history(mock, group.id, repayment.id))
    await notFound(balances(mock, group.id))
    await notFound(balances(mock, group.id, { currency: 'PLN' }))

    await refused(addRepayment(mock, group.id, { amount: 1_000, currency: 'EUR', date: today }), {
      fromMemberId: ['validation.required'],
      toMemberId: ['validation.required'],
    })
    await refused(editRepayment(mock, group.id, 'gpay_missing', { amount: 1_000, currency: 'EUR', date: today }), {
      fromMemberId: ['validation.required'],
      toMemberId: ['validation.required'],
    })
    mock.db.state.activeUserId = 'usr_anna'
    expect((await listRepayments(mock, group.id)).items).toEqual([repayment])
  })

  it('removes the repayments and their history with the group', async () => {
    const mock = api()
    const { group, anna, max } = await trip(mock)
    await addRepayment(mock, group.id, eur(max, anna, 2_000))

    await deleteGroup(mock, group.id)

    expect(mock.db.state.groupRepayments).toEqual([])
    expect(mock.db.state.groupEvents).toEqual([])
  })
})

const albania = async (mock: MockApi) => {
  quoteRate(mock, 'ALL', 0.044, day(-9))
  quoteRate(mock, 'EUR', 4.3, day(-9))
  const group = await createGroup(mock, { name: 'Albania 2026', members: ['Anna', 'Olya', 'Max', 'Kasia'] })
  const [anna, olya, max, kasia] = group.members.map((member) => member.id) as [string, string, string, string]
  const date = day(-9)
  await addExpense(mock, group.id, { payerId: anna, amount: 12_000, currency: 'EUR', date })
  await addExpense(mock, group.id, { payerId: olya, amount: 300_000, currency: 'ALL', date })
  await addExpense(mock, group.id, {
    payerId: max,
    amount: 4_000,
    currency: 'EUR',
    date,
    split: { mode: 'equal', memberIds: [anna, max] },
  })
  await addRepayment(mock, group.id, eur(kasia, anna, 2_000, { date }))
  const taxi = await addExpense(mock, group.id, { payerId: kasia, amount: 5_000, currency: 'EUR', date })
  await deleteExpense(mock, group.id, taxi.id)
  const mistaken = await addRepayment(mock, group.id, eur(olya, max, 1_500, { date }))
  await deleteRepayment(mock, group.id, mistaken.id)
  return { group, anna, olya, max, kasia }
}

describe('group balances', () => {
  it('computes the balances and the suggested transfers of the live entries', async () => {
    const mock = api()
    const { group, anna, olya, max, kasia } = await albania(mock)

    const page = await balances(mock, group.id)

    expect(Object.keys(page)).toEqual(['currency', 'groupCurrency', 'total', 'members', 'transfers'])
    expect(page).toMatchObject({ currency: 'EUR', groupCurrency: 'EUR', total: 19_070 })
    expect(page.members.map((member) => member.memberId)).toEqual([anna, olya, max, kasia])
    for (const member of page.members) {
      expect(Object.keys(member)).toEqual(['memberId', 'paid', 'share', 'sent', 'received', 'balance'])
    }
    expect(figures(page)).toEqual([
      [12_000, 5_768, 0, 2_000, 4_232],
      [3_070, 3_768, 0, 0, -698],
      [4_000, 5_767, 0, 0, -1_767],
      [0, 3_767, 2_000, 0, -1_767],
    ])
    expect(page.members.map((member) => member.balance)).toEqual([4_232, -698, -1_767, -1_767])
    expect(transfersOf(page)).toEqual([
      [max, anna, 1_767],
      [kasia, anna, 1_767],
      [olya, anna, 698],
    ])
    for (const transfer of page.transfers) {
      expect(Object.keys(transfer)).toEqual(['fromMemberId', 'toMemberId', 'amount'])
    }
    expect(await balances(mock, group.id, { currency: 'EUR' })).toEqual(page)
  })

  it('shows every figure in another currency at the latest stored rate', async () => {
    const mock = api()
    const { group, anna, olya, max, kasia } = await albania(mock)

    const page = await balances(mock, group.id, { currency: 'PLN' })

    expect(page).toMatchObject({ currency: 'PLN', groupCurrency: 'EUR', total: 82_001 })
    expect(figures(page)[0]).toEqual([51_600, 24_802, 0, 8_600, 18_198])
    expect(page.members[1]?.balance).toBe(-3_001)
    expect(transfersOf(page)).toEqual([
      [max, anna, 7_598],
      [kasia, anna, 7_598],
      [olya, anna, 3_001],
    ])
  })

  it('reads the view rate whatever its age', async () => {
    const mock = api()
    const { group } = await albania(mock)
    quoteRate(mock, 'EUR', 4.3, day(-200))
    quoteRate(mock, 'USD', 3.9, day(-200))

    const page = await balances(mock, group.id, { currency: 'USD' })

    expect(page).toMatchObject({ currency: 'USD', groupCurrency: 'EUR' })
    expect(page.members[0]?.balance).toBe(4_666)
  })

  it('answers 503 when the view currency or the main currency has no stored rate', async () => {
    const mock = api()
    const { group } = await trip(mock)
    const kuwaiti = await createGroup(mock, { name: 'Kuwait', currency: 'KWD' })
    mock.db.state.rates = mock.db.state.rates.filter((row) => row.from !== 'KWD')

    await unavailable(balances(mock, group.id, { currency: 'KWD' }))
    await unavailable(balances(mock, kuwaiti.id, { currency: 'EUR' }))
    expect(await balances(mock, kuwaiti.id)).toMatchObject({ currency: 'KWD', groupCurrency: 'KWD', total: 0 })
    expect(await balances(mock, kuwaiti.id, { currency: 'KWD' })).toMatchObject({ currency: 'KWD' })
  })

  it.each([['eur'], [''], ['XDR'], [' EUR']])(
    'refuses the view currency %j before looking up the group',
    async (value) => {
      const mock = api()
      const { group } = await trip(mock)

      await refused(balances(mock, group.id, { currency: value }), { currency: ['validation.invalidValue'] })
      await refused(balances(mock, 'grp_missing', { currency: value }), { currency: ['validation.invalidValue'] })
    },
  )

  it('gives zeros and no transfers to a group without entries', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)

    const page = await balances(mock, group.id)

    expect(page).toEqual({
      currency: 'EUR',
      groupCurrency: 'EUR',
      total: 0,
      members: [anna, olya, max].map((memberId) => ({
        memberId,
        paid: 0,
        share: 0,
        sent: 0,
        received: 0,
        balance: 0,
      })),
      transfers: [],
    })
    expect(await balances(mock, group.id, { currency: 'PLN' })).toMatchObject({ currency: 'PLN', total: 0 })
  })

  it('takes deleted entries out and puts them back when they are restored', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    const expense = await addExpense(mock, group.id, { payerId: anna, amount: 9_000, currency: 'EUR', date: today })
    const repayment = await addRepayment(mock, group.id, eur(olya, anna, 1_000))
    const balanceOf = async () => (await balances(mock, group.id)).members.map((member) => member.balance)
    expect(await balanceOf()).toEqual([5_000, -2_000, -3_000])

    await deleteExpense(mock, group.id, expense.id)
    expect(await balanceOf()).toEqual([-1_000, 1_000, 0])
    await deleteRepayment(mock, group.id, repayment.id)
    expect(await balanceOf()).toEqual([0, 0, 0])
    expect((await balances(mock, group.id)).transfers).toEqual([])

    await restoreExpense(mock, group.id, expense.id)
    await restoreRepayment(mock, group.id, repayment.id)

    const page = await balances(mock, group.id)
    expect(page.members.map((member) => member.balance)).toEqual([5_000, -2_000, -3_000])
    expect(transfersOf(page)).toEqual([
      [max, anna, 3_000],
      [olya, anna, 2_000],
    ])
  })

  it('turns the balance around when a repayment is larger than the debt', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    await addExpense(mock, group.id, { payerId: anna, amount: 9_000, currency: 'EUR', date: today })
    await addRepayment(mock, group.id, eur(max, anna, 5_000))

    const page = await balances(mock, group.id)

    expect(page.members.map((member) => member.balance)).toEqual([1_000, -3_000, 2_000])
    expect(transfersOf(page)).toEqual([
      [olya, max, 2_000],
      [olya, anna, 1_000],
    ])
  })

  it('keeps every balance at zero in total for many entries in several currencies and splits', async () => {
    const mock = api()
    const names = ['Anna', 'Olya', 'Max', 'Kasia', 'Piotr', 'Zoe']
    const group = await createGroup(mock, { name: 'Many', members: names })
    const members = group.members.map((member) => member.id)
    let seed = 20_261_023
    const next = (limit: number): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296
      return Math.floor((seed / 4_294_967_296) * limit)
    }
    const pick = <T>(items: readonly T[]): T => items[next(items.length)] as T
    const currencies = [
      { currency: 'EUR' },
      { currency: 'PLN', rate: 0.23 },
      { currency: 'JPY', rate: 0.0061 },
      { currency: 'KWD', rate: 3 },
    ]

    for (let index = 0; index < 30; index++) {
      const amount = 500 + next(400_000)
      const picked = members.filter(() => next(2) === 0)
      const sharing = picked.length > 0 ? picked : [pick(members)]
      const kind = next(3)
      const exact = () => {
        const weights = sharing.map(() => 1 + next(99))
        const extra = amount - sharing.length
        const parts = weights.map((weight) => Math.floor((extra * weight) / weights.reduce((a, b) => a + b, 0)))
        const rest = extra - parts.reduce((a, b) => a + b, 0)
        return sharing.map((memberId, position) => ({
          memberId,
          amount: 1 + (parts[position] ?? 0) + (position === sharing.length - 1 ? rest : 0),
        }))
      }
      const split =
        kind === 0 ? undefined : kind === 1 ? { mode: 'equal', memberIds: sharing } : { mode: 'exact', shares: exact() }
      await addExpense(mock, group.id, { payerId: pick(members), amount, date: today, split, ...pick(currencies) })
    }
    for (let index = 0; index < 10; index++) {
      const from = next(members.length)
      const to = (from + 1 + next(members.length - 1)) % members.length
      await addRepayment(mock, group.id, {
        fromMemberId: members[from],
        toMemberId: members[to],
        amount: 100 + next(50_000),
        date: today,
        ...pick(currencies),
      })
    }

    const page = await balances(mock, group.id)

    expect(page.members.map((member) => member.memberId)).toEqual(members)
    const sum = (key: 'paid' | 'share' | 'sent' | 'received' | 'balance') =>
      page.members.reduce((total, member) => total + member[key], 0)
    expect(sum('balance')).toBe(0)
    expect(sum('sent')).toBe(sum('received'))
    expect(sum('paid')).toBe(page.total)
    expect(sum('share')).toBe(page.total)
    for (const member of page.members) {
      expect(member.balance).toBe(member.paid - member.share + member.sent - member.received)
    }
    const expenses = mock.db.state.groupExpenses
    expect(expenses).toHaveLength(30)
    expect(page.total).toBe(expenses.reduce((total, row) => total + row.groupAmount, 0))
    const remaining = new Map(page.members.map((member) => [member.memberId, member.balance]))
    for (const transfer of page.transfers) {
      expect(transfer.amount).toBeGreaterThan(0)
      remaining.set(transfer.fromMemberId, (remaining.get(transfer.fromMemberId) ?? 0) + transfer.amount)
      remaining.set(transfer.toMemberId, (remaining.get(transfer.toMemberId) ?? 0) - transfer.amount)
    }
    expect([...remaining.values()].every((balance) => balance === 0)).toBe(true)
    expect(page.transfers.length).toBeLessThan(members.length)
  })
})

describe('settle', () => {
  const rows = (...values: number[]) => values.map((balance, index) => ({ memberId: `m${index}`, balance }))
  const move = (from: number, to: number, amount: number) => ({
    fromMemberId: `m${from}`,
    toMemberId: `m${to}`,
    amount,
  })

  it('pays the largest creditor when no balances match', () => {
    expect(settle(rows(4_232, -698, -1_767, -1_767))).toEqual([move(2, 0, 1_767), move(3, 0, 1_767), move(1, 0, 698)])
  })

  it('settles exact pairs first', () => {
    expect(settle(rows(400, 300, 300, -600, -400))).toEqual([move(4, 0, 400), move(3, 1, 300), move(3, 2, 300)])
  })

  it('suggests nothing when everyone is settled', () => {
    expect(settle(rows(0, 0, 0))).toEqual([])
    expect(settle([])).toEqual([])
  })

  it('refuses balances that do not add up to zero', () => {
    expect(() => settle(rows(1, 0))).toThrow()
  })

  it('settles everyone with fewer transfers than members with a balance', () => {
    let seed = 20_261_023
    const next = (limit: number): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296
      return Math.floor((seed / 4_294_967_296) * limit)
    }
    for (let run = 0; run < 300; run++) {
      const spread = run % 2 === 0 ? 30 : 1_000_000
      const count = 2 + next(11)
      const amounts = Array.from({ length: count - 1 }, () => next(2 * spread + 1) - spread)
      const balances = rows(-amounts.reduce((total, amount) => total + amount, 0), ...amounts)

      const transfers = settle(balances)

      const remaining = new Map(balances.map((row) => [row.memberId, row.balance]))
      for (const transfer of transfers) {
        expect(transfer.amount).toBeGreaterThan(0)
        remaining.set(transfer.fromMemberId, (remaining.get(transfer.fromMemberId) ?? 0) + transfer.amount)
        remaining.set(transfer.toMemberId, (remaining.get(transfer.toMemberId) ?? 0) - transfer.amount)
      }
      expect([...remaining.values()].every((balance) => balance === 0)).toBe(true)
      const nonZero = balances.filter((row) => row.balance !== 0).length
      expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1))
    }
  })
})
