import { describe, expect, it } from 'bun:test'
import {
  type GroupCategoryDto,
  type GroupDto,
  type GroupEntryEvent,
  type GroupExpenseDto,
  type GroupExpenseState,
  type GroupMemberDto,
  type GroupSummaryDto,
  type Page,
  standardGroupCategories,
} from '../../../app/shared/api/contract'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import type { MockApi } from '../../../mocks/api'
import { MockHttpError } from '../../../mocks/errors'
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

const groupKeys = ['categories', 'currency', 'currencyLocked', 'id', 'members', 'name', 'total']

const stateKeys = [
  'amount',
  'categoryId',
  'currency',
  'date',
  'description',
  'groupAmount',
  'payerId',
  'rate',
  'rateManual',
  'shares',
  'split',
  'tags',
]

const expenseKeys = [...stateKeys, 'createdAt', 'createdBy', 'deleted', 'id', 'updatedAt', 'updatedBy'].sort()

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
const listGroups = (mock: MockApi, query: Record<string, string> = {}) =>
  mock.handle({ method: 'GET', path: '/v1/groups', query }) as Promise<Page<GroupSummaryDto>>
const addMember = (mock: MockApi, id: string, name: unknown) =>
  mock.handle({ method: 'POST', path: `/v1/groups/${id}/members`, body: { name } }) as Promise<GroupMemberDto>
const renameMember = (mock: MockApi, id: string, memberId: string, name: unknown) =>
  mock.handle({
    method: 'PUT',
    path: `/v1/groups/${id}/members/${memberId}`,
    body: { name },
  }) as Promise<GroupMemberDto>
const removeMember = (mock: MockApi, id: string, memberId: string) =>
  mock.handle({ method: 'DELETE', path: `/v1/groups/${id}/members/${memberId}` })
const addCategory = (mock: MockApi, id: string, name: unknown) =>
  mock.handle({ method: 'POST', path: `/v1/groups/${id}/categories`, body: { name } }) as Promise<GroupCategoryDto>

const expensesPath = (groupId: string) => `/v1/groups/${groupId}/expenses`
const addExpense = (mock: MockApi, groupId: string, body: unknown) =>
  mock.handle({ method: 'POST', path: expensesPath(groupId), body }) as Promise<GroupExpenseDto>
const editExpense = (mock: MockApi, groupId: string, expenseId: string, body: unknown) =>
  mock.handle({ method: 'PUT', path: `${expensesPath(groupId)}/${expenseId}`, body }) as Promise<GroupExpenseDto>
const deleteExpense = (mock: MockApi, groupId: string, expenseId: string) =>
  mock.handle({ method: 'DELETE', path: `${expensesPath(groupId)}/${expenseId}` })
const restoreExpense = (mock: MockApi, groupId: string, expenseId: string) =>
  mock.handle({ method: 'POST', path: `${expensesPath(groupId)}/${expenseId}/restore` }) as Promise<GroupExpenseDto>
const listExpenses = (mock: MockApi, groupId: string, query: Record<string, string> = {}) =>
  mock.handle({ method: 'GET', path: expensesPath(groupId), query }) as Promise<Page<GroupExpenseDto>>
const history = (mock: MockApi, groupId: string, expenseId: string, query: Record<string, string> = {}) =>
  mock.handle({
    method: 'GET',
    path: `${expensesPath(groupId)}/${expenseId}/history`,
    query,
  }) as Promise<Page<GroupEntryEvent<GroupExpenseState>>>

const trip = async (mock: MockApi, patch: Record<string, unknown> = {}) => {
  const group = await createGroup(mock, patch)
  const [anna, olya, max] = group.members.map((member) => member.id) as [string, string, string]
  return { group, anna, olya, max }
}

const sharesOf = (expense: Pick<GroupExpenseDto, 'shares'>) =>
  expense.shares.map((share) => [share.memberId, share.amount, share.groupAmount])

describe('groups', () => {
  it('creates a group with trimmed names, the members in order and the standard categories', async () => {
    const mock = api()
    const group = await createGroup(mock, { name: '  Albania 2026 ', members: ['Anna', ' Olya ', 'Max'] })
    expect(Object.keys(group).sort()).toEqual(groupKeys)
    expect(group.id).toStartWith('grp_')
    expect(group).toMatchObject({ name: 'Albania 2026', currency: 'EUR', currencyLocked: false, total: 0 })
    expect(group.members.map((member) => [member.name, member.inUse])).toEqual([
      ['Anna', false],
      ['Olya', false],
      ['Max', false],
    ])
    expect(new Set(group.members.map((member) => member.id)).size).toBe(3)
    expect(group.categories).toEqual(standardGroupCategories.map((id) => ({ id, standard: true, name: null })))
    expect(await getGroup(mock, group.id)).toEqual(group)
  })

  it('reports every invalid field of a new group in one answer', async () => {
    await refused(createGroup(api(), { name: '   ', currency: 'XDR', members: ['Max', ' max '] }), {
      name: ['validation.required'],
      currency: ['validation.invalidValue'],
      members: ['validation.memberNameTaken'],
    })
    await refused(api().handle({ method: 'POST', path: '/v1/groups' }), {
      name: ['validation.required'],
      currency: ['validation.required'],
      members: ['validation.required'],
    })
  })

  it.each([
    ['name', 5, 'validation.invalidValue'],
    ['name', 'Tr\u0007ip', 'validation.invalidValue'],
    ['name', 'a'.repeat(41), 'validation.nameTooLong'],
    ['currency', 'eur', 'validation.invalidValue'],
    ['members', [], 'validation.required'],
    ['members', '  ', 'validation.required'],
    ['members', 'Anna', 'validation.invalidValue'],
    ['members', ['Anna', 5], 'validation.invalidValue'],
    ['members', ['Anna', ' '], 'validation.invalidValue'],
    ['members', ['A\u0000'], 'validation.invalidValue'],
    ['members', ['a'.repeat(41)], 'validation.nameTooLong'],
    ['members', Array.from({ length: 51 }, (_, index) => `Member ${index}`), 'validation.tooManyMembers'],
    [
      'members',
      [...Array.from({ length: 51 }, (_, index) => `Member ${index}`), 'a'.repeat(41)],
      'validation.nameTooLong',
    ],
  ])('refuses a group whose %s is %p', async (field, value, code) => {
    await refused(createGroup(api(), { [field]: value }), { [field]: [code] })
  })

  it('lists the own groups newest first with their member count and live total', async () => {
    const mock = api()
    const { group: first, anna } = await trip(mock, { name: 'First' })
    await addExpense(mock, first.id, { payerId: anna, amount: 12_000, currency: 'EUR', date: today })
    const removed = await addExpense(mock, first.id, { payerId: anna, amount: 500, currency: 'EUR', date: today })
    await deleteExpense(mock, first.id, removed.id)
    const second = await createGroup(mock, { name: 'Second', currency: 'PLN', members: ['Kasia'] })
    mock.db.state.activeUserId = 'usr_oleh'
    await createGroup(mock, { name: 'Foreign' })
    mock.db.state.activeUserId = 'usr_anna'

    const page = await listGroups(mock)

    expect(page).toEqual({
      items: [
        { id: second.id, name: 'Second', currency: 'PLN', members: 1, total: 0 },
        { id: first.id, name: 'First', currency: 'EUR', members: 3, total: 12_000 },
      ],
      page: 1,
      pageSize: 100,
      total: 2,
    })
    expect((await listGroups(mock, { pageSize: '1', page: '2' })).items.map((item) => item.name)).toEqual(['First'])
    await refused(listGroups(mock, { pageSize: '101' }), { pageSize: ['validation.invalidValue'] })
  })

  it('changes the main currency only while the group has no entries', async () => {
    const mock = api()
    const { group, anna } = await trip(mock)
    expect(await updateGroup(mock, group.id, { name: ' Albania ', currency: 'PLN' })).toMatchObject({
      name: 'Albania',
      currency: 'PLN',
      currencyLocked: false,
    })
    const expense = await addExpense(mock, group.id, { payerId: anna, amount: 1_000, currency: 'PLN', date: today })
    await deleteExpense(mock, group.id, expense.id)

    await refused(updateGroup(mock, group.id, { name: 'Albania', currency: 'EUR' }), {
      currency: ['validation.groupCurrencyLocked'],
    })
    expect(await updateGroup(mock, group.id, { name: 'Trip', currency: 'PLN' })).toMatchObject({
      name: 'Trip',
      currency: 'PLN',
      currencyLocked: true,
      total: 0,
    })
    await refused(updateGroup(mock, group.id, { name: ' ', currency: 'XDR' }), {
      name: ['validation.required'],
      currency: ['validation.invalidValue'],
    })
  })

  it('deletes a group with everything in it', async () => {
    const mock = api()
    const { group, anna } = await trip(mock)
    await addCategory(mock, group.id, 'Beach')
    await addExpense(mock, group.id, { payerId: anna, amount: 1_000, currency: 'EUR', date: today })
    const kept = await createGroup(mock, { name: 'Kept' })

    expect(await deleteGroup(mock, group.id)).toBeUndefined()

    await notFound(getGroup(mock, group.id))
    await notFound(deleteGroup(mock, group.id))
    const { state } = mock.db
    expect(state.groups.map((row) => row.id)).toEqual([kept.id])
    expect(state.groupMembers.every((row) => row.groupId === kept.id)).toBe(true)
    expect(state.groupCategories).toHaveLength(0)
    expect(state.groupExpenses).toHaveLength(0)
    expect(state.groupEvents).toHaveLength(0)
  })
})

describe('group members', () => {
  it('adds a member at the end and refuses a name another member has', async () => {
    const mock = api()
    const { group } = await trip(mock)
    await refused(addMember(mock, group.id, ' anna '), { name: ['validation.memberNameTaken'] })
    const kasia = await addMember(mock, group.id, ' Kasia ')
    expect(Object.keys(kasia).sort()).toEqual(['id', 'inUse', 'name'])
    expect(kasia).toMatchObject({ name: 'Kasia', inUse: false })
    expect((await getGroup(mock, group.id)).members.map((member) => member.name)).toEqual([
      'Anna',
      'Olya',
      'Max',
      'Kasia',
    ])
    await refused(addMember(mock, group.id, '  '), { name: ['validation.required'] })
    await refused(addMember(mock, group.id, 'a'.repeat(41)), { name: ['validation.nameTooLong'] })
  })

  it('refuses a 51st member but answers a taken name first', async () => {
    const mock = api()
    const full = await createGroup(mock, { members: Array.from({ length: 50 }, (_, index) => `Member ${index + 1}`) })
    await refused(addMember(mock, full.id, 'member 1'), { name: ['validation.memberNameTaken'] })
    await refused(addMember(mock, full.id, 'Kasia'), { name: ['validation.tooManyMembers'] })
  })

  it('renames a member but not to the name of another member', async () => {
    const mock = api()
    const { group, anna, olya } = await trip(mock)
    await refused(renameMember(mock, group.id, olya, 'ANNA'), { name: ['validation.memberNameTaken'] })
    expect(await renameMember(mock, group.id, anna, ' ANNA ')).toEqual({ id: anna, name: 'ANNA', inUse: false })
    await notFound(renameMember(mock, group.id, 'mbr_missing', 'Kasia'))
  })

  it('removes an unused member but refuses one an entry refers to, deleted entries included', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    const kasia = (await addMember(mock, group.id, 'Kasia')).id
    const expense = await addExpense(mock, group.id, {
      payerId: anna,
      amount: 1_000,
      currency: 'EUR',
      date: today,
      split: { mode: 'equal', memberIds: [olya] },
    })
    await deleteExpense(mock, group.id, expense.id)

    await refused(removeMember(mock, group.id, olya), { memberId: ['validation.memberInUse'] })
    await refused(removeMember(mock, group.id, anna), { memberId: ['validation.memberInUse'] })
    expect(await removeMember(mock, group.id, max)).toBeUndefined()
    await notFound(removeMember(mock, group.id, max))

    expect((await getGroup(mock, group.id)).members).toEqual([
      { id: anna, name: 'Anna', inUse: true },
      { id: olya, name: 'Olya', inUse: true },
      { id: kasia, name: 'Kasia', inUse: false },
    ])
    expect(await renameMember(mock, group.id, olya, 'Ola')).toEqual({ id: olya, name: 'Ola', inUse: true })
  })

  it('keeps the shares of past expenses when a member is added', async () => {
    const mock = api()
    const { group, anna } = await trip(mock)
    const before = await addExpense(mock, group.id, { payerId: anna, amount: 9_000, currency: 'EUR', date: today })
    await addMember(mock, group.id, 'Kasia')
    expect((await listExpenses(mock, group.id)).items).toEqual([before])
  })
})

describe('group categories', () => {
  it('adds a category after the standard ones', async () => {
    const mock = api()
    const { group } = await trip(mock)
    const beach = await addCategory(mock, group.id, ' Beach ')
    expect(Object.keys(beach).sort()).toEqual(['id', 'name', 'standard'])
    expect(beach).toMatchObject({ standard: false, name: 'Beach' })
    const transfers = await addCategory(mock, group.id, 'Transfers')
    expect((await getGroup(mock, group.id)).categories.slice(9)).toEqual([beach, transfers])
  })

  it.each([['beach'], ['Spożywcze'], ['продукти'], ['ДРУГОЕ'], ['Other']])(
    'refuses the name %p that a category of the group or a standard category has',
    async (name) => {
      const mock = api()
      const { group } = await trip(mock)
      await addCategory(mock, group.id, 'Beach')
      await refused(addCategory(mock, group.id, name), { name: ['validation.categoryNameTaken'] })
    },
  )

  it('refuses a 101st category but answers a taken name first', async () => {
    const mock = api()
    const { group } = await trip(mock)
    for (let index = 1; index <= 100; index++) await addCategory(mock, group.id, `Category ${index}`)
    await refused(addCategory(mock, group.id, 'category 7'), { name: ['validation.categoryNameTaken'] })
    await refused(addCategory(mock, group.id, 'Spożywcze'), { name: ['validation.categoryNameTaken'] })
    await refused(addCategory(mock, group.id, 'Beach'), { name: ['validation.tooManyCategories'] })
  })
})

describe('group expenses', () => {
  it('splits an expense equally between every member by default', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)

    const expense = await addExpense(mock, group.id, { payerId: olya, amount: 10_000, currency: 'EUR', date: today })

    expect(Object.keys(expense).sort()).toEqual(expenseKeys)
    expect(expense.id).toStartWith('gexp_')
    expect(expense).toMatchObject({
      payerId: olya,
      amount: 10_000,
      currency: 'EUR',
      date: today,
      categoryId: 'other',
      tags: [],
      description: null,
      rate: 1,
      rateManual: false,
      groupAmount: 10_000,
      split: 'equal',
      deleted: false,
      createdBy: owner,
      updatedBy: null,
      updatedAt: null,
    })
    expect(expense.createdAt).toMatch(ISO_MILLISECONDS)
    expect(sharesOf(expense)).toEqual([
      [anna, 3_333, 3_333],
      [olya, 3_334, 3_334],
      [max, 3_333, 3_333],
    ])
    const read = await getGroup(mock, group.id)
    expect(read).toMatchObject({ currencyLocked: true, total: 10_000 })
    expect(read.members.map((member) => member.inUse)).toEqual([true, true, true])
  })

  it('gives the remainder to the payer first, then in member order', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    const expense = await addExpense(mock, group.id, { payerId: max, amount: 10_001, currency: 'EUR', date: today })
    expect(sharesOf(expense)).toEqual([
      [anna, 3_334, 3_334],
      [olya, 3_333, 3_333],
      [max, 3_334, 3_334],
    ])
  })

  it('splits between some members and drops those whose equal share rounds to zero', async () => {
    const mock = api()
    const { group, anna, max } = await trip(mock)
    const some = await addExpense(mock, group.id, {
      payerId: max,
      amount: 4_000,
      currency: 'EUR',
      date: today,
      split: { mode: 'equal', memberIds: [max, anna] },
    })
    expect(some.split).toBe('equal')
    expect(sharesOf(some)).toEqual([
      [anna, 2_000, 2_000],
      [max, 2_000, 2_000],
    ])

    const yen = await trip(mock, { name: 'Tokyo', currency: 'JPY' })
    const two = await addExpense(mock, yen.group.id, { payerId: yen.olya, amount: 2, currency: 'JPY', date: today })
    expect(sharesOf(two)).toEqual([
      [yen.anna, 1, 1],
      [yen.olya, 1, 1],
    ])
    const one = await addExpense(mock, yen.group.id, { payerId: yen.olya, amount: 1, currency: 'JPY', date: today })
    expect(sharesOf(one)).toEqual([[yen.olya, 1, 1]])
  })

  it('converts at the rate of the date into the main currency and keeps every share whole', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    const kasia = (await addMember(mock, group.id, 'Kasia')).id

    const stored = await addExpense(mock, group.id, { payerId: olya, amount: 300_000, currency: 'ALL', date: rateDay })

    expect(stored).toMatchObject({ currency: 'ALL', rate: 0.0102326, rateManual: false, groupAmount: 3_070 })
    expect(sharesOf(stored)).toEqual([
      [anna, 75_000, 768],
      [olya, 75_000, 768],
      [max, 75_000, 767],
      [kasia, 75_000, 767],
    ])

    const manual = await addExpense(mock, group.id, {
      payerId: olya,
      amount: 300_000,
      currency: 'ALL',
      date: rateDay,
      rate: 0.0105,
    })
    expect(manual).toMatchObject({ rate: 0.0105, rateManual: true, groupAmount: 3_150 })
    expect(manual.shares.reduce((sum, share) => sum + share.groupAmount, 0)).toBe(3_150)

    const yen = await addExpense(mock, group.id, { payerId: anna, amount: 1_500, currency: 'JPY', date: today })
    expect(yen).toMatchObject({ rate: 0.00575907, rateManual: false, groupAmount: 864 })
  })

  it('splits exactly and converts the shares with the expense', async () => {
    const mock = api()
    const { group, olya, max } = await trip(mock)
    const expense = await addExpense(mock, group.id, {
      payerId: olya,
      amount: 30_000,
      currency: 'PLN',
      date: today,
      rate: 0.25,
      split: {
        mode: 'exact',
        shares: [
          { memberId: max, amount: 20_000 },
          { memberId: olya, amount: 10_000 },
        ],
      },
    })
    expect(expense).toMatchObject({ rate: 0.25, rateManual: true, groupAmount: 7_500, split: 'exact' })
    expect(sharesOf(expense)).toEqual([
      [olya, 10_000, 2_500],
      [max, 20_000, 5_000],
    ])
  })

  it('refuses a stale rate and writes nothing, but takes a manual rate', async () => {
    const mock = api()
    quoteRate(mock, 'ALL', 0.044, day(-40))
    const { group, olya } = await trip(mock)
    const body = { payerId: olya, amount: 300_000, currency: 'ALL', date: today }

    await unavailable(addExpense(mock, group.id, body))

    expect(mock.db.state.groupExpenses).toHaveLength(0)
    expect(mock.db.state.groupEvents).toHaveLength(0)
    expect(await addExpense(mock, group.id, { ...body, rate: 0.0105 })).toMatchObject({ groupAmount: 3_150 })
  })

  it('refuses a converted amount that rounds to zero or is too large', async () => {
    const mock = api()
    const { group, anna } = await trip(mock)
    const body = { payerId: anna, currency: 'PLN', date: today }
    await refused(addExpense(mock, group.id, { ...body, amount: 1, rate: 0.001 }), {
      rate: ['validation.positiveAmount'],
    })
    await refused(addExpense(mock, group.id, { ...body, amount: 100_000_000_000, rate: 2 }), {
      rate: ['validation.invalidValue'],
    })
    expect(mock.db.state.groupExpenses).toHaveLength(0)
  })

  it('reports an exact split that does not add up to the amount', async () => {
    const mock = api()
    const { group, anna, olya } = await trip(mock)
    const exact = (first: number, second: number) => ({
      mode: 'exact',
      shares: [
        { memberId: anna, amount: first },
        { memberId: olya, amount: second },
      ],
    })
    const body = { payerId: anna, amount: 10_000, currency: 'EUR', date: today }
    await refused(addExpense(mock, group.id, { ...body, split: exact(4_000, 5_999) }), {
      split: ['validation.splitMismatch'],
    })
    await refused(addExpense(mock, group.id, { ...body, split: exact(10_000, 1) }), {
      split: ['validation.splitMismatch'],
    })
    await refused(addExpense(mock, group.id, { ...body, amount: 0, split: exact(4_000, 5_999) }), {
      amount: ['validation.positiveAmount'],
    })
  })

  it('reports an unknown payer', async () => {
    const mock = api()
    const { group } = await trip(mock)
    await refused(addExpense(mock, group.id, { payerId: 'mbr_missing', amount: 1_000, currency: 'EUR', date: today }), {
      payerId: ['validation.unknownMember'],
    })
    await refused(addExpense(mock, group.id, { payerId: 5, amount: 1_000, currency: 'EUR', date: today }), {
      payerId: ['validation.unknownMember'],
    })
    expect(mock.db.state.groupExpenses).toHaveLength(0)
  })

  it('reports every reference outside the group together', async () => {
    const mock = api()
    const { group, anna } = await trip(mock)
    const other = await trip(mock, { name: 'Other' })
    const ferry = await addCategory(mock, other.group.id, 'Ferry')

    await refused(
      addExpense(mock, group.id, {
        payerId: other.anna,
        amount: 1_000,
        currency: 'EUR',
        date: today,
        categoryId: ferry.id,
        split: { mode: 'equal', memberIds: [anna, other.olya] },
      }),
      {
        payerId: ['validation.unknownMember'],
        categoryId: ['validation.unknownCategory'],
        split: ['validation.unknownMember'],
      },
    )
    expect(mock.db.state.groupExpenses).toHaveLength(0)
  })

  it('stores the tags, the description and the category', async () => {
    const mock = api()
    const { group, anna } = await trip(mock)
    const beach = await addCategory(mock, group.id, 'Beach')
    const own = await addExpense(mock, group.id, {
      payerId: anna,
      amount: 1_000,
      currency: 'EUR',
      date: today,
      categoryId: beach.id,
      tags: [' Beach ', 'beach', 'food'],
      description: '  Dinner ',
    })
    expect(own).toMatchObject({ categoryId: beach.id, tags: ['Beach', 'food'], description: 'Dinner' })
    const standard = await addExpense(mock, group.id, {
      payerId: anna,
      amount: 1_000,
      currency: 'EUR',
      date: today,
      categoryId: 'cafes',
    })
    expect(standard.categoryId).toBe('cafes')
  })

  describe('validation rows', () => {
    type Ids = { anna: string; olya: string }
    type Value = unknown | ((ids: Ids) => unknown)

    const equal = (...memberIds: unknown[]) => ({ mode: 'equal', memberIds })
    const exact = (...shares: [unknown, unknown][]) => ({
      mode: 'exact',
      shares: shares.map(([memberId, amount]) => ({ memberId, amount })),
    })
    const tags = (count: number) => Array.from({ length: count }, (_, index) => `Tag ${index + 1}`)
    const valid = ({ anna, olya }: Ids) => ({
      payerId: anna,
      amount: 10_000,
      currency: 'EUR',
      date: today,
      categoryId: 'groceries',
      tags: ['Beach'],
      description: 'Dinner',
      rate: 4.5,
      split: equal(anna, olya),
    })
    const setup = async () => {
      const mock = api()
      const { group, anna, olya } = await trip(mock)
      return { mock, group, ids: { anna, olya } }
    }
    const resolve = (value: Value, ids: Ids) => (typeof value === 'function' ? value(ids) : value)

    const invalid: [string, Value, string][] = [
      ['payerId', null, 'validation.required'],
      ['payerId', '  ', 'validation.required'],
      ['payerId', 5, 'validation.unknownMember'],
      ['payerId', 'x', 'validation.unknownMember'],
      ['amount', null, 'validation.required'],
      ['amount', 1.5, 'validation.invalidValue'],
      ['amount', '10', 'validation.invalidValue'],
      ['amount', 100_000_000_001, 'validation.invalidValue'],
      ['amount', 0, 'validation.positiveAmount'],
      ['amount', -5, 'validation.positiveAmount'],
      ['currency', null, 'validation.required'],
      ['currency', 'eur', 'validation.invalidValue'],
      ['currency', 'XDR', 'validation.invalidValue'],
      ['date', null, 'validation.required'],
      ['date', '2026-02-30', 'validation.invalidValue'],
      ['date', 20261018, 'validation.invalidValue'],
      ['date', addDaysIso(oneYearAhead(today), 1), 'validation.dateTooFar'],
      ['categoryId', 'food', 'validation.unknownCategory'],
      ['categoryId', 'transfer', 'validation.unknownCategory'],
      ['categoryId', 'Groceries', 'validation.unknownCategory'],
      ['categoryId', ' cafes ', 'validation.unknownCategory'],
      ['categoryId', 5, 'validation.unknownCategory'],
      ['tags', 'Beach', 'validation.invalidValue'],
      ['tags', tags(11), 'validation.tooManyTags'],
      ['tags', ['a'.repeat(31)], 'validation.tagTooLong'],
      ['description', 5, 'validation.invalidValue'],
      ['description', 'A\u0007', 'validation.invalidValue'],
      ['description', 'a'.repeat(101), 'validation.titleTooLong'],
      ['rate', 0, 'validation.invalidValue'],
      ['rate', '4', 'validation.invalidValue'],
      ['rate', 1_000_000_001, 'validation.invalidValue'],
      ['split', '', 'validation.invalidValue'],
      ['split', 'equal', 'validation.invalidValue'],
      ['split', 5, 'validation.invalidValue'],
      ['split', [], 'validation.invalidValue'],
      ['split', { mode: 'ratio' }, 'validation.invalidValue'],
      ['split', ({ anna }: Ids) => ({ memberIds: [anna] }), 'validation.invalidValue'],
      ['split', equal(), 'validation.invalidValue'],
      ['split', { mode: 'equal' }, 'validation.invalidValue'],
      ['split', ({ anna }: Ids) => equal(anna, anna), 'validation.invalidValue'],
      ['split', ({ anna }: Ids) => equal(anna, ` ${anna} `), 'validation.invalidValue'],
      ['split', equal(...Array.from({ length: 51 }, (_, index) => `mbr_${index}`)), 'validation.invalidValue'],
      ['split', equal('x'), 'validation.unknownMember'],
      ['split', equal(5), 'validation.unknownMember'],
      ['split', equal('x', 'y'), 'validation.unknownMember'],
      ['split', ({ anna, olya }: Ids) => exact([anna, 4_000], [olya, 5_999]), 'validation.splitMismatch'],
      ['split', ({ anna, olya }: Ids) => exact([anna, 10_000], [olya, 1]), 'validation.splitMismatch'],
      ['split', ({ anna }: Ids) => exact([anna, 10_001]), 'validation.splitMismatch'],
      ['split', ({ anna }: Ids) => exact([anna, 0]), 'validation.invalidValue'],
      ['split', ({ anna, olya }: Ids) => exact([anna, 1.5], [olya, 9_998.5]), 'validation.invalidValue'],
      ['split', ({ anna }: Ids) => exact([anna, '10000']), 'validation.invalidValue'],
      ['split', ({ anna }: Ids) => exact([anna, 5_000], [anna, 5_000]), 'validation.invalidValue'],
      ['split', exact(['x', 10_000]), 'validation.unknownMember'],
      ['split', { mode: 'exact', shares: [{ amount: 5_000 }, { amount: 5_000 }] }, 'validation.unknownMember'],
      ['split', ({ anna }: Ids) => equal(anna, anna, 42), 'validation.invalidValue'],
      ['split', ({ anna }: Ids) => equal(anna, 'x', anna), 'validation.invalidValue'],
      ['split', equal('x', ' x '), 'validation.invalidValue'],
      ['split', equal(42, 42), 'validation.invalidValue'],
      ['split', exact(['x', 5_000], ['x', 5_000]), 'validation.invalidValue'],
      [
        'split',
        ({ anna }: Ids) => ({
          mode: 'exact',
          shares: [{ memberId: anna, amount: 4_000 }, { memberId: anna, amount: 3_000 }, { amount: 3_000 }],
        }),
        'validation.invalidValue',
      ],
      ['split', ({ anna }: Ids) => exact([anna, 6_000], ['x', 0]), 'validation.invalidValue'],
      ['split', { mode: 'exact', shares: [] }, 'validation.invalidValue'],
      ['split', { mode: 'exact', shares: [5] }, 'validation.invalidValue'],
      ['split', ({ anna }: Ids) => ({ mode: 'exact', memberIds: [anna] }), 'validation.invalidValue'],
    ]

    it.each(invalid)('refuses %s %p', async (field, value, code) => {
      const { mock, group, ids } = await setup()
      await refused(addExpense(mock, group.id, { ...valid(ids), [field]: resolve(value, ids) }), { [field]: [code] })
      expect(mock.db.state.groupExpenses).toHaveLength(0)
    })

    it.each(['payerId', 'amount', 'currency', 'date'])('requires %s', async (field) => {
      const { mock, group, ids } = await setup()
      const { [field as keyof ReturnType<typeof valid>]: _left, ...body } = valid(ids)
      await refused(addExpense(mock, group.id, body), { [field]: ['validation.required'] })
    })

    const accepted: [string, Value, Partial<GroupExpenseDto>][] = [
      ['amount', 100_000_000_000, { amount: 100_000_000_000, groupAmount: 100_000_000_000 }],
      ['amount', 5.0, { amount: 5 }],
      ['currency', 'KWD', { currency: 'KWD', rate: 4.5, rateManual: true, groupAmount: 4_500 }],
      ['date', oneYearAhead(today), { date: oneYearAhead(today) }],
      ['categoryId', 'other', { categoryId: 'other' }],
      ['categoryId', null, { categoryId: 'other' }],
      ['categoryId', '  ', { categoryId: 'other' }],
      ['tags', tags(10), { tags: tags(10) }],
      ['tags', [], { tags: [] }],
      ['tags', null, { tags: [] }],
      ['description', `  ${'a'.repeat(100)}  `, { description: 'a'.repeat(100) }],
      ['description', '   ', { description: null }],
      ['description', null, { description: null }],
      ['rate', 1e-9, { rate: 1, rateManual: false }],
      ['rate', 1_000_000_000, { rate: 1, rateManual: false }],
      ['rate', '', { rate: 1, rateManual: false }],
      ['rate', '  ', { rate: 1, rateManual: false }],
      ['rate', null, { rate: 1, rateManual: false }],
      ['split', null, { split: 'equal' }],
      ['split', ({ olya }: Ids) => equal(olya), { split: 'equal', amount: 10_000 }],
      ['split', ({ olya }: Ids) => equal(` ${olya} `), { split: 'equal' }],
      ['split', ({ anna, olya }: Ids) => exact([anna, 4_000], [olya, 6_000]), { split: 'exact' }],
      ['split', ({ olya }: Ids) => exact([olya, 10_000]), { split: 'exact' }],
    ]

    it.each(accepted)('accepts %s %p', async (field, value, expected) => {
      const { mock, group, ids } = await setup()
      const created = await addExpense(mock, group.id, { ...valid(ids), [field]: resolve(value, ids) })
      expect(created).toMatchObject(expected)
    })

    it('stores the members of an equal or exact split by their id', async () => {
      const { mock, group, ids } = await setup()
      const padded = await addExpense(mock, group.id, { ...valid(ids), split: equal(` ${ids.olya} `) })
      expect(sharesOf(padded)).toEqual([[ids.olya, 10_000, 10_000]])
    })
  })
})

describe('expense changes', () => {
  it('updates, deletes and restores an expense and records every change', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    const created = await addExpense(mock, group.id, { payerId: anna, amount: 9_000, currency: 'EUR', date: today })

    const updated = await editExpense(mock, group.id, created.id, {
      payerId: max,
      amount: 12_000,
      currency: 'EUR',
      date: today,
    })

    expect(updated).toMatchObject({ id: created.id, amount: 12_000, groupAmount: 12_000, payerId: max })
    expect(sharesOf(updated)).toEqual([
      [anna, 4_000, 4_000],
      [olya, 4_000, 4_000],
      [max, 4_000, 4_000],
    ])
    expect(updated.createdBy).toEqual(created.createdBy)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedBy).toEqual(owner)
    expect(updated.updatedAt).toMatch(ISO_MILLISECONDS)

    expect(await deleteExpense(mock, group.id, created.id)).toBeUndefined()
    expect((await listExpenses(mock, group.id)).total).toBe(0)
    expect((await getGroup(mock, group.id)).total).toBe(0)
    const removed = await listExpenses(mock, group.id, { deleted: 'true' })
    expect(removed.items.map((item) => [item.id, item.deleted])).toEqual([[created.id, true]])
    expect(removed.items[0]?.updatedBy).toEqual(owner)
    await notFound(editExpense(mock, group.id, created.id, { payerId: max, amount: 1, currency: 'EUR', date: today }))
    await notFound(deleteExpense(mock, group.id, created.id))

    const restored = await restoreExpense(mock, group.id, created.id)

    expect(restored).toEqual({ ...updated, updatedAt: restored.updatedAt })
    expect((await getGroup(mock, group.id)).total).toBe(12_000)
    await notFound(restoreExpense(mock, group.id, created.id))

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
    expect(updatedState).toMatchObject({ amount: 12_000, payerId: max, shares: updated.shares })
    expect(createdState).toMatchObject({ amount: 9_000, payerId: anna, shares: created.shares })
    expect((await history(mock, group.id, created.id, { pageSize: '1' })).items.map((event) => event.action)).toEqual([
      'restored',
    ])
  })

  it('splits an edit without a split between every member the group has now', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    const created = await addExpense(mock, group.id, {
      payerId: max,
      amount: 4_000,
      currency: 'EUR',
      date: today,
      split: { mode: 'equal', memberIds: [max, anna] },
    })
    const kasia = (await addMember(mock, group.id, 'Kasia')).id

    const edited = await editExpense(mock, group.id, created.id, {
      payerId: max,
      amount: 8_000,
      currency: 'EUR',
      date: today,
    })

    expect(sharesOf(edited).map(([memberId]) => memberId)).toEqual([anna, olya, max, kasia])
    const [latest] = (await history(mock, group.id, created.id)).items
    expect(latest?.state.shares.map((share) => share.memberId)).toEqual([anna, olya, max, kasia])
  })

  it('prices an edit again at the rate of its date unless a manual rate is sent', async () => {
    const mock = api()
    const { group, olya } = await trip(mock)
    const body = { payerId: olya, amount: 300_000, currency: 'ALL', date: rateDay }
    const created = await addExpense(mock, group.id, { ...body, rate: 0.0105 })
    expect(created).toMatchObject({ rateManual: true, groupAmount: 3_150 })

    expect(await editExpense(mock, group.id, created.id, body)).toMatchObject({
      rate: 0.0102326,
      rateManual: false,
      groupAmount: 3_070,
    })
    quoteRate(mock, 'ALL', 0.044, day(-40))
    await unavailable(editExpense(mock, group.id, created.id, { ...body, date: today }))
    expect(await editExpense(mock, group.id, created.id, { ...body, date: today, rate: 0.0105 })).toMatchObject({
      rateManual: true,
      groupAmount: 3_150,
    })
  })

  it('lists live and deleted expenses newest first', async () => {
    const mock = api()
    const { group, anna, olya, max } = await trip(mock)
    const add = (payerId: string, amount: number, date: string) =>
      addExpense(mock, group.id, { payerId, amount, currency: 'EUR', date })
    const oldest = await add(anna, 1_000, day(-3))
    const newest = await add(olya, 3_000, day(-1))
    const middle = await add(max, 2_000, day(-2))
    const sameDay = await add(max, 2_500, day(-2))
    const removed = await add(anna, 4_000, today)
    await deleteExpense(mock, group.id, removed.id)

    const live = await listExpenses(mock, group.id)

    expect(live).toMatchObject({ page: 1, pageSize: 100, total: 4 })
    expect(live.items.map((item) => item.id)).toEqual([newest.id, sameDay.id, middle.id, oldest.id])
    expect((await listExpenses(mock, group.id, { deleted: 'false' })).total).toBe(4)
    expect((await listExpenses(mock, group.id, { deleted: 'true' })).items.map((item) => item.id)).toEqual([removed.id])
    expect((await listExpenses(mock, group.id, { pageSize: '2' })).items.map((item) => item.id)).toEqual([
      newest.id,
      sameDay.id,
    ])
    await refused(listExpenses(mock, group.id, { deleted: 'yes' }), { deleted: ['validation.invalidValue'] })
    await refused(listExpenses(mock, group.id, { deleted: 'True' }), { deleted: ['validation.invalidValue'] })
    await refused(listExpenses(mock, 'grp_missing', { page: '0' }), { page: ['validation.invalidValue'] })
    await refused(history(mock, 'grp_missing', 'gexp_missing', { pageSize: '0' }), {
      pageSize: ['validation.invalidValue'],
    })
  })
})

describe('group access', () => {
  it("answers 404 for another user's group and for an entry of another group", async () => {
    const mock = api()
    const { group, anna } = await trip(mock)
    const expense = await addExpense(mock, group.id, { payerId: anna, amount: 1_000, currency: 'EUR', date: today })
    const other = await trip(mock, { name: 'Other' })
    const otherExpense = await addExpense(mock, other.group.id, {
      payerId: other.anna,
      amount: 1_000,
      currency: 'EUR',
      date: today,
    })
    const body = { payerId: anna, amount: 1_000, currency: 'EUR', date: today }

    await notFound(editExpense(mock, group.id, otherExpense.id, body))
    await notFound(deleteExpense(mock, group.id, otherExpense.id))
    await notFound(restoreExpense(mock, group.id, otherExpense.id))
    await notFound(history(mock, group.id, otherExpense.id))
    await notFound(renameMember(mock, group.id, other.anna, 'Kasia'))
    await notFound(removeMember(mock, group.id, other.anna))

    mock.db.state.activeUserId = 'usr_oleh'
    await notFound(getGroup(mock, group.id))
    await notFound(updateGroup(mock, group.id, { name: 'Mine', currency: 'EUR' }))
    await notFound(deleteGroup(mock, group.id))
    await notFound(addMember(mock, group.id, 'Kasia'))
    await notFound(renameMember(mock, group.id, anna, 'Kasia'))
    await notFound(removeMember(mock, group.id, anna))
    await notFound(addCategory(mock, group.id, 'Beach'))
    await notFound(listExpenses(mock, group.id))
    await notFound(addExpense(mock, group.id, body))
    await notFound(editExpense(mock, group.id, expense.id, body))
    await notFound(deleteExpense(mock, group.id, expense.id))
    await notFound(restoreExpense(mock, group.id, expense.id))
    await notFound(history(mock, group.id, expense.id))
    expect((await listGroups(mock)).items).toEqual([])

    await refused(addExpense(mock, group.id, { amount: 1_000, currency: 'EUR', date: today }), {
      payerId: ['validation.required'],
    })
    await refused(addMember(mock, group.id, ' '), { name: ['validation.required'] })
    mock.db.state.activeUserId = 'usr_anna'
    expect((await listExpenses(mock, group.id)).items).toEqual([expense])
  })
})
