import { describe, expect, it } from 'bun:test'
import type {
  AccountDto,
  BudgetPage,
  CategoryDto,
  GroupActorDto,
  GroupDto,
  GroupExpenseDto,
  GroupRepaymentDto,
  OverviewDto,
  Page,
  ReportDto,
  ToConfirmItemDto,
  TransactionDto,
} from '../../../app/shared/api/contract'
import type { HttpMethod } from '../../../app/shared/api/transport'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import type { MockApi } from '../../../mocks/api'
import { MockHttpError } from '../../../mocks/errors'
import { loggedInMockApi, quoteRate } from './session'

const today = todayIso()
const day = (offset: number) => addDaysIso(today, offset)

const ALBANIA = 'grp_albania'
const [anna, olya, max, kasia] = ['gmb_anna', 'gmb_olya', 'gmb_max', 'gmb_kasia'] as const
const CASH = 'acc_anna_cash'
const EURO = 'acc_anna_eur'
const owner: GroupActorDto = { kind: 'owner', memberId: null, name: 'Anna Nowak' }
const categoryOf = (key: string) => `cat_anna_expense_${key}`

const ITEM_KEYS = [
  'kind',
  'entryId',
  'groupId',
  'groupName',
  'groupCurrency',
  'change',
  'version',
  'at',
  'actor',
  'current',
  'previous',
  'other',
  'lines',
  'suggestedAccountId',
]
const EXPENSE_TERM_KEYS = ['amount', 'currency', 'date', 'share', 'categoryId', 'tags', 'description']
const PAID_TERM_KEYS = ['direction', 'memberId', 'amount', 'currency', 'date', 'groupAmount', 'covers']
const RECEIVED_TERM_KEYS = ['direction', 'memberId', 'amount', 'currency', 'date']
const LINE_KEYS = ['expenseId', 'description', 'amount', 'currency', 'suggestion']
const SUGGESTION_KEYS = ['categoryId', 'newCategory', 'title', 'tags']
const CATEGORY_KEYS = ['color', 'id', 'inUse', 'kind', 'name', 'system']

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

const itemChanged = async (promise: Promise<unknown>) =>
  expect(await problemOf(promise)).toEqual({ status: 409, title: 'Conflict', code: 'group.itemChanged' })

const unavailable = async (promise: Promise<unknown>) =>
  expect(await problemOf(promise)).toMatchObject({ status: 503, code: 'rates.unavailable' })

const api = (userId?: string): MockApi => {
  const mock = loggedInMockApi(userId)
  quoteRate(mock, 'EUR', 4.3, day(-12))
  return mock
}

const send = (mock: MockApi, method: HttpMethod, path: string, body?: unknown) => mock.handle({ method, path, body })
const get = <T>(mock: MockApi, path: string, query: Record<string, string> = {}) =>
  mock.handle({ method: 'GET', path, query }) as Promise<T>

const groupPath = (suffix = '', groupId = ALBANIA) => `/v1/groups/${groupId}${suffix}`
const thisIsMe = (mock: MockApi, memberId: string = anna, groupId = ALBANIA) =>
  send(mock, 'PUT', groupPath(`/members/${memberId}/link`, groupId))
const unlink = (mock: MockApi, memberId: string = anna) => send(mock, 'DELETE', groupPath(`/members/${memberId}/link`))

const list = (mock: MockApi, query: Record<string, string> = {}) =>
  get<Page<ToConfirmItemDto>>(mock, '/v1/to-confirm', query)
const findItem = async (mock: MockApi, entryId: string) =>
  (await list(mock)).items.find((item) => item.entryId === entryId)
const itemOf = async (mock: MockApi, entryId: string): Promise<ToConfirmItemDto> => {
  const item = await findItem(mock, entryId)
  if (!item) throw new Error(`${entryId} is not listed`)
  return item
}

const pathKind = (item: Pick<ToConfirmItemDto, 'kind'>) => (item.kind === 'expense' ? 'expenses' : 'repayments')
const confirm = (mock: MockApi, kind: string, entryId: string, body: unknown) =>
  send(mock, 'POST', `/v1/to-confirm/${kind}/${entryId}/confirm`, body)
const reject = (mock: MockApi, kind: string, entryId: string, body: unknown) =>
  send(mock, 'POST', `/v1/to-confirm/${kind}/${entryId}/reject`, body)

const suggested = (item: ToConfirmItemDto, accountId: string, rate?: number) => ({
  version: item.version,
  accountId,
  ...(rate === undefined ? {} : { rate }),
  lines: item.lines.map(({ suggestion }) => ({ ...suggestion })),
})

const confirmSuggested = (mock: MockApi, item: ToConfirmItemDto, accountId: string, rate?: number) =>
  confirm(mock, pathKind(item), item.entryId, suggested(item, accountId, rate))

const expenseBody = (patch: Record<string, unknown> = {}) => ({
  payerId: anna,
  amount: 12_000,
  currency: 'EUR',
  date: today,
  categoryId: 'cafes',
  tags: ['dinner'],
  description: 'Dinner',
  ...patch,
})
const addExpense = (mock: MockApi, patch: Record<string, unknown> = {}, groupId = ALBANIA) =>
  send(mock, 'POST', groupPath('/expenses', groupId), expenseBody(patch)) as Promise<GroupExpenseDto>
const editExpense = (mock: MockApi, id: string, patch: Record<string, unknown> = {}) =>
  send(mock, 'PUT', groupPath(`/expenses/${id}`), expenseBody(patch)) as Promise<GroupExpenseDto>
const deleteExpense = (mock: MockApi, id: string) => send(mock, 'DELETE', groupPath(`/expenses/${id}`))
const restoreExpense = (mock: MockApi, id: string) => send(mock, 'POST', groupPath(`/expenses/${id}/restore`))
const addRepayment = (mock: MockApi, body: Record<string, unknown>) =>
  send(mock, 'POST', groupPath('/repayments'), { currency: 'EUR', date: today, ...body }) as Promise<GroupRepaymentDto>

const accounts = async (mock: MockApi) => (await get<Page<AccountDto>>(mock, '/v1/accounts')).items
const balanceOf = async (mock: MockApi, accountId: string) =>
  (await accounts(mock)).find((account) => account.id === accountId)?.balance
const addAccount = async (mock: MockApi, patch: Record<string, unknown> = {}) =>
  (await send(mock, 'POST', '/v1/accounts', {
    name: 'Wallet',
    type: 'cash',
    currency: 'PLN',
    openingBalance: 0,
    ...patch,
  })) as AccountDto
const expenseCategories = async (mock: MockApi) =>
  (await get<Page<CategoryDto>>(mock, '/v1/categories', { kind: 'expense' })).items

const confirmationOf = (mock: MockApi, entryId: string) =>
  mock.db.state.groupConfirmations.find((row) => row.entryId === entryId)
const bookedFor = (mock: MockApi, entryId: string) => {
  const { state } = mock.db
  const confirmationId = confirmationOf(mock, entryId)?.id
  const ids = new Set(
    state.groupConfirmationTransactions
      .filter((link) => link.confirmationId === confirmationId)
      .map((link) => link.transactionId),
  )
  return state.transactions.filter((row) => ids.has(row.id))
}
const amountsFor = (mock: MockApi, entryId: string) =>
  bookedFor(mock, entryId).map((row) => [row.amount, row.accountAmount])
const legsFor = (mock: MockApi, entryId: string) => {
  const confirmationId = confirmationOf(mock, entryId)?.id
  return mock.db.state.groupLegs
    .filter((leg) => leg.confirmationId === confirmationId)
    .map((leg) => [leg.accountId, leg.date, leg.accountAmount])
}
const transactionOf = (mock: MockApi, id: string) => get<TransactionDto>(mock, `/v1/transactions/${id}`)

describe('to confirm list', () => {
  it('lists nothing to a user who is linked nowhere', async () => {
    const mock = api()

    expect(await list(mock)).toEqual({ items: [], page: 1, pageSize: 100, total: 0 })
  })

  it('lists the dinner Anna paid and the payment Kasia made once Anna says This is me', async () => {
    const mock = api()
    await thisIsMe(mock)
    const eventAt = (id: string) => mock.db.state.groupEvents.find((event) => event.id === id)?.at

    const page = await list(mock)

    expect(page.total).toBe(2)
    const [payment, dinner] = page.items
    expect(Object.keys(dinner ?? {})).toEqual(ITEM_KEYS)
    expect(dinner).toEqual({
      kind: 'expense',
      entryId: 'gex_dinner',
      groupId: ALBANIA,
      groupName: 'Albania 2026',
      groupCurrency: 'EUR',
      change: 'new',
      version: 'gevt_gex_dinner_2.gmb_anna',
      at: eventAt('gevt_gex_dinner_2') as string,
      actor: owner,
      current: {
        amount: 12_000,
        currency: 'EUR',
        date: day(-10),
        share: 3_000,
        categoryId: 'cafes',
        tags: ['dinner'],
        description: 'Dinner',
      },
      previous: null,
      other: 9_000,
      lines: [
        {
          expenseId: 'gex_dinner',
          description: 'Dinner',
          amount: 3_000,
          currency: 'EUR',
          suggestion: { categoryId: categoryOf('cafes'), newCategory: null, title: 'Dinner', tags: ['dinner'] },
        },
      ],
      suggestedAccountId: null,
    })
    expect(Object.keys(dinner?.current ?? {})).toEqual(EXPENSE_TERM_KEYS)
    expect(Object.keys(dinner?.lines[0] ?? {})).toEqual(LINE_KEYS)
    expect(Object.keys(dinner?.lines[0]?.suggestion ?? {})).toEqual(SUGGESTION_KEYS)
    expect(payment).toEqual({
      kind: 'repayment',
      entryId: 'gpay_kasia_anna',
      groupId: ALBANIA,
      groupName: 'Albania 2026',
      groupCurrency: 'EUR',
      change: 'new',
      version: 'gevt_gpay_kasia_anna_1.gmb_anna',
      at: eventAt('gevt_gpay_kasia_anna_1') as string,
      actor: owner,
      current: { direction: 'received', memberId: kasia, amount: 2_000, currency: 'EUR', date: day(-7) },
      previous: null,
      other: 2_000,
      lines: [],
      suggestedAccountId: null,
    })
    expect(Object.keys(payment?.current ?? {})).toEqual(RECEIVED_TERM_KEYS)
    const [repayment] = (await get<Page<GroupRepaymentDto>>(mock, groupPath('/repayments'))).items
    expect(repayment?.covers).toEqual([
      { expenseId: 'gex_dinner', groupAmount: 2_000, description: 'Dinner', categoryId: 'cafes' },
    ])
  })

  it('reads the count with pageSize 1 and refuses invalid paging', async () => {
    const mock = api()
    await thisIsMe(mock)

    const page = await list(mock, { pageSize: '1' })

    expect(page).toMatchObject({ page: 1, pageSize: 1, total: 2 })
    expect(page.items.map((item) => item.entryId)).toEqual(['gpay_kasia_anna'])
    expect((await list(mock, { page: '2', pageSize: '1' })).items.map((item) => item.entryId)).toEqual(['gex_dinner'])
    await refused(list(mock, { pageSize: '101' }), { pageSize: ['validation.invalidValue'] })
    await refused(list(mock, { page: '0' }), { page: ['validation.invalidValue'] })
  })

  it('hides the entries deleted before anyone decided on them', async () => {
    const mock = api()
    await thisIsMe(mock)
    const removed = await addExpense(mock)
    await deleteExpense(mock, removed.id)
    const live = await addExpense(mock)

    expect((await list(mock)).items.map((item) => item.entryId)).toEqual([live.id, 'gpay_kasia_anna', 'gex_dinner'])
  })

  it('shows each user only the entries of their own member', async () => {
    const mock = api()
    await thisIsMe(mock)

    expect((await list(mock)).items.map((item) => item.entryId)).toEqual(['gpay_kasia_anna', 'gex_dinner'])
    mock.db.state.activeUserId = 'usr_oleh'
    const [pierogi] = (await list(mock)).items
    expect((await list(mock)).total).toBe(1)
    expect(pierogi).toMatchObject({
      entryId: 'gex_pierogi',
      groupId: 'grp_krakow',
      groupCurrency: 'PLN',
      current: { amount: 30_000, currency: 'PLN', share: 10_000 },
      other: 20_000,
      lines: [
        {
          expenseId: 'gex_pierogi',
          amount: 10_000,
          suggestion: { categoryId: 'cat_oleh_expense_cafes', newCategory: null, title: 'Pierogi', tags: [] },
        },
      ],
    })
  })

  it('suggests categories by standard key, by name, as a new category and never the transfer category', async () => {
    const mock = api()
    await thisIsMe(mock)
    await send(mock, 'DELETE', `/v1/categories/${categoryOf('health')}`)
    const ferry = (await send(mock, 'POST', '/v1/categories', {
      name: 'ferry',
      kind: 'expense',
      color: 'chart-1',
    })) as CategoryDto
    await send(mock, 'POST', '/v1/categories', { name: 'Boat', kind: 'income', color: 'chart-2' })
    const addGroupCategory = async (name: string) =>
      ((await send(mock, 'POST', groupPath('/categories'), { name })) as { id: string }).id
    const ferryGroup = await addGroupCategory('Ferry')
    const boatGroup = await addGroupCategory('Boat')
    const transfersGroup = await addGroupCategory('Przelewy')
    const pharmacy = await addExpense(mock, { categoryId: 'health', description: 'Pharmacy' })
    const crossing = await addExpense(mock, { categoryId: ferryGroup, description: 'Crossing' })
    const boat = await addExpense(mock, { categoryId: boatGroup, description: null })
    const taxi = await addExpense(mock, { categoryId: transfersGroup, description: 'Taxi' })

    const suggestionOf = async (entryId: string) => (await itemOf(mock, entryId)).lines[0]?.suggestion

    expect(await suggestionOf(pharmacy.id)).toEqual({
      categoryId: categoryOf('other'),
      newCategory: null,
      title: 'Pharmacy',
      tags: ['dinner'],
    })
    expect(await suggestionOf(crossing.id)).toEqual({
      categoryId: ferry.id,
      newCategory: null,
      title: 'Crossing',
      tags: ['dinner'],
    })
    expect(await suggestionOf(boat.id)).toEqual({
      categoryId: null,
      newCategory: 'Boat',
      title: 'Albania 2026',
      tags: ['dinner'],
    })
    expect(await suggestionOf(taxi.id)).toMatchObject({ categoryId: categoryOf('other'), newCategory: null })
    expect(await confirmSuggested(mock, await itemOf(mock, taxi.id), CASH)).toBeUndefined()
  })
})

describe('confirming an expense Anna paid', () => {
  it('books only the share as spending and the rest as money owed to Anna', async () => {
    const mock = api()
    await thisIsMe(mock)
    const overviewBefore = await get<OverviewDto>(mock, '/v1/overview')
    const cafesBudget = async () =>
      (await get<BudgetPage>(mock, '/v1/budgets')).items.find((row) => row.categoryId === categoryOf('cafes'))?.spent ??
      0
    const cafesReport = async () => {
      const report = await get<ReportDto>(mock, '/v1/reports')
      return {
        income: report.totals.income,
        cafes: report.structure.items.find((row) => row.categoryId === categoryOf('cafes'))?.amount ?? 0,
      }
    }
    const budgetBefore = await cafesBudget()
    const reportBefore = await cafesReport()
    const balanceBefore = (await balanceOf(mock, CASH)) as number
    const lunch = await addExpense(mock, { tags: ['lunch'], description: 'Lunch' })

    expect(await confirmSuggested(mock, await itemOf(mock, lunch.id), CASH)).toBeUndefined()

    const [booked] = bookedFor(mock, lunch.id)
    expect(await transactionOf(mock, booked?.id as string)).toEqual({
      id: booked?.id as string,
      kind: 'expense',
      date: today,
      title: 'Lunch',
      note: null,
      categoryId: categoryOf('cafes'),
      accountId: CASH,
      amount: 3_000,
      currency: 'EUR',
      accountAmount: 12_900,
      rate: 4.3,
      baseAmount: 12_900,
      tags: [{ id: expect.any(String), name: 'lunch' }],
    })
    expect(bookedFor(mock, lunch.id)).toHaveLength(1)
    expect(legsFor(mock, lunch.id)).toEqual([[CASH, today, -38_700]])
    expect(await balanceOf(mock, CASH)).toBe(balanceBefore - 51_600)
    const overview = await get<OverviewDto>(mock, '/v1/overview')
    expect(overview.expense.amount).toBe(overviewBefore.expense.amount + 12_900)
    expect(overview.income.amount).toBe(overviewBefore.income.amount)
    expect(overview.balance.amount).toBe(overviewBefore.balance.amount - 51_600)
    expect(await cafesBudget()).toBe(budgetBefore + 12_900)
    expect(await cafesReport()).toEqual({ income: reportBefore.income, cafes: reportBefore.cafes + 12_900 })
    expect(await findItem(mock, lunch.id)).toBeUndefined()
    expect(confirmationOf(mock, lunch.id)).toMatchObject({
      userId: 'usr_anna',
      groupId: ALBANIA,
      kind: 'expense',
      accountId: CASH,
      handledTerms: { amount: 12_000, share: 3_000 },
      confirmedTerms: { amount: 12_000, share: 3_000 },
    })
  })

  it('books the seeded dinner at the rate of its date into an account of another currency', async () => {
    const mock = api()
    await thisIsMe(mock)
    const before = (await balanceOf(mock, EURO)) as number

    await confirmSuggested(mock, await itemOf(mock, 'gex_dinner'), EURO)

    expect(
      bookedFor(mock, 'gex_dinner').map((row) => [row.amount, row.accountAmount, row.rate, row.baseAmount]),
    ).toEqual([[3_000, 3_000, 1, 12_900]])
    expect(bookedFor(mock, 'gex_dinner')[0]).toMatchObject({ date: day(-10), currency: 'EUR', accountId: EURO })
    expect(legsFor(mock, 'gex_dinner')).toEqual([[EURO, day(-10), -9_000]])
    expect(await balanceOf(mock, EURO)).toBe(before - 12_000)
  })

  it('books the whole amount as a leg when Anna paid without a share', async () => {
    const mock = api()
    await thisIsMe(mock)
    const overviewBefore = await get<OverviewDto>(mock, '/v1/overview')
    const forOlya = await addExpense(mock, { split: { mode: 'equal', memberIds: [olya] } })
    const item = await itemOf(mock, forOlya.id)

    expect(item).toMatchObject({ current: { share: 0 }, lines: [], other: 12_000 })
    await confirmSuggested(mock, item, CASH)

    expect(bookedFor(mock, forOlya.id)).toEqual([])
    expect(legsFor(mock, forOlya.id)).toEqual([[CASH, today, -51_600]])
    const overview = await get<OverviewDto>(mock, '/v1/overview')
    expect(overview.expense.amount).toBe(overviewBefore.expense.amount)
    expect(overview.income.amount).toBe(overviewBefore.income.amount)
  })

  it('creates a category for a new name and uses an existing one of the same name', async () => {
    const mock = api()
    await thisIsMe(mock)
    const countBefore = (await expenseCategories(mock)).length
    const trips = await addExpense(mock)
    const lunch = await addExpense(mock, { amount: 6_000 })

    await confirm(mock, 'expenses', trips.id, {
      version: (await itemOf(mock, trips.id)).version,
      accountId: CASH,
      lines: [{ newCategory: '  Trips ', title: 'Ferry', tags: ['dinner'] }],
    })
    await confirm(mock, 'expenses', lunch.id, {
      version: (await itemOf(mock, lunch.id)).version,
      accountId: CASH,
      lines: [{ categoryId: null, newCategory: 'kawiarnie', title: 'Lunch' }],
    })

    const categories = await expenseCategories(mock)
    expect(categories).toHaveLength(countBefore + 1)
    const created = categories.find((row) => row.name === 'Trips')
    expect(created).toEqual({
      id: expect.any(String),
      name: 'Trips',
      kind: 'expense',
      color: 'chart-4',
      system: null,
      inUse: true,
    })
    expect(mock.db.state.categories.find((row) => row.id === created?.id)?.standardKey).toBeNull()
    expect(bookedFor(mock, trips.id).map((row) => [row.categoryId, row.title])).toEqual([[created?.id ?? '', 'Ferry']])
    expect(bookedFor(mock, lunch.id).map((row) => [row.categoryId, row.title, row.tagIds])).toEqual([
      [categoryOf('cafes'), 'Lunch', []],
    ])
  })

  it('keeps the records until a change is confirmed and follows every later change', async () => {
    const mock = api()
    await thisIsMe(mock)
    const start = (await balanceOf(mock, CASH)) as number
    const date = day(-2)
    const dinner = await addExpense(mock, { date })
    await confirm(mock, 'expenses', dinner.id, {
      version: (await itemOf(mock, dinner.id)).version,
      accountId: CASH,
      lines: [{ categoryId: categoryOf('leisure'), title: 'Team dinner', tags: ['work'] }],
    })

    await editExpense(mock, dinner.id, { date, amount: 16_000 })

    expect(amountsFor(mock, dinner.id)).toEqual([[3_000, 12_900]])
    expect(await balanceOf(mock, CASH)).toBe(start - 51_600)
    const changed = await itemOf(mock, dinner.id)
    expect(changed).toMatchObject({
      change: 'changed',
      previous: { amount: 12_000, share: 3_000, tags: ['dinner'] },
      current: { amount: 16_000, share: 4_000 },
      other: 12_000,
      suggestedAccountId: CASH,
    })
    expect(changed.lines[0]?.suggestion).toEqual({
      categoryId: categoryOf('leisure'),
      newCategory: null,
      title: 'Team dinner',
      tags: ['work'],
    })

    await confirmSuggested(mock, changed, CASH)

    expect(amountsFor(mock, dinner.id)).toEqual([[4_000, 17_200]])
    expect(bookedFor(mock, dinner.id).map((row) => [row.categoryId, row.title])).toEqual([
      [categoryOf('leisure'), 'Team dinner'],
    ])
    expect(legsFor(mock, dinner.id)).toEqual([[CASH, date, -51_600]])
    expect(await balanceOf(mock, CASH)).toBe(start - 68_800)

    await deleteExpense(mock, dinner.id)

    const removed = await itemOf(mock, dinner.id)
    expect(removed).toMatchObject({
      change: 'removed',
      current: null,
      previous: { amount: 16_000 },
      lines: [],
      other: 0,
    })
    expect(await reject(mock, 'expenses', dinner.id, { version: removed.version })).toBeUndefined()
    expect(amountsFor(mock, dinner.id)).toEqual([[4_000, 17_200]])
    expect(await balanceOf(mock, CASH)).toBe(start - 68_800)
    expect(await findItem(mock, dinner.id)).toBeUndefined()

    await restoreExpense(mock, dinner.id)
    expect(await findItem(mock, dinner.id)).toBeUndefined()
    await deleteExpense(mock, dinner.id)
    expect(await findItem(mock, dinner.id)).toBeUndefined()
    await restoreExpense(mock, dinner.id)
    await editExpense(mock, dinner.id, { date, amount: 8_000 })

    const again = await itemOf(mock, dinner.id)
    expect(again).toMatchObject({ change: 'changed', previous: { amount: 16_000 } })
    await confirmSuggested(mock, again, CASH)

    expect(amountsFor(mock, dinner.id)).toEqual([[2_000, 8_600]])
    expect(legsFor(mock, dinner.id)).toEqual([[CASH, date, -25_800]])
    expect(await balanceOf(mock, CASH)).toBe(start - 34_400)
    expect(await findItem(mock, dinner.id)).toBeUndefined()
  })

  it('replaces only the records that still exist and suggests from the expense when they are gone', async () => {
    const mock = api()
    await thisIsMe(mock)
    const dinner = await addExpense(mock, { date: day(-2) })
    await confirm(mock, 'expenses', dinner.id, {
      version: (await itemOf(mock, dinner.id)).version,
      accountId: CASH,
      lines: [{ categoryId: categoryOf('leisure'), title: 'Team dinner' }],
    })
    const [booked] = bookedFor(mock, dinner.id)
    await send(mock, 'DELETE', `/v1/transactions/${booked?.id}`)
    const count = mock.db.state.transactions.length

    await editExpense(mock, dinner.id, { date: day(-2), amount: 16_000 })

    const changed = await itemOf(mock, dinner.id)
    expect(changed.lines[0]?.suggestion).toEqual({
      categoryId: categoryOf('cafes'),
      newCategory: null,
      title: 'Dinner',
      tags: ['dinner'],
    })
    await confirmSuggested(mock, changed, CASH)
    expect(mock.db.state.transactions).toHaveLength(count + 1)
    expect(amountsFor(mock, dinner.id)).toEqual([[4_000, 17_200]])
    expect(legsFor(mock, dinner.id)).toEqual([[CASH, day(-2), -51_600]])
  })

  it('removes the records when a removal is confirmed and suggests the account again after a restore', async () => {
    const mock = api()
    await thisIsMe(mock)
    const wallet = await addAccount(mock)
    const dinner = await addExpense(mock, { date: day(-2) })
    await confirmSuggested(mock, await itemOf(mock, dinner.id), wallet.id)
    expect(await balanceOf(mock, wallet.id)).toBe(-51_600)
    await deleteExpense(mock, dinner.id)
    const removed = await itemOf(mock, dinner.id)

    await refused(confirm(mock, 'expenses', dinner.id, { version: removed.version, accountId: 7 }), {
      accountId: ['validation.unknownAccount'],
    })
    expect(await confirm(mock, 'expenses', dinner.id, { version: removed.version })).toBeUndefined()

    expect(bookedFor(mock, dinner.id)).toEqual([])
    expect(legsFor(mock, dinner.id)).toEqual([])
    expect(await balanceOf(mock, wallet.id)).toBe(0)
    expect(confirmationOf(mock, dinner.id)).toMatchObject({
      handledTerms: null,
      confirmedTerms: null,
      accountId: wallet.id,
    })
    expect(await findItem(mock, dinner.id)).toBeUndefined()

    await restoreExpense(mock, dinner.id)

    expect(await itemOf(mock, dinner.id)).toMatchObject({
      change: 'new',
      previous: null,
      suggestedAccountId: wallet.id,
    })
    await send(mock, 'DELETE', `/v1/accounts/${wallet.id}`)
    expect((await itemOf(mock, dinner.id)).suggestedAccountId).toBeNull()
  })

  it('does not suggest an archived account when the item holds no records', async () => {
    const mock = api()
    await thisIsMe(mock)
    const wallet = await addAccount(mock)
    const dinner = await addExpense(mock, { date: day(-2) })
    await confirmSuggested(mock, await itemOf(mock, dinner.id), wallet.id)
    await deleteExpense(mock, dinner.id)
    await confirm(mock, 'expenses', dinner.id, { version: (await itemOf(mock, dinner.id)).version })
    await send(mock, 'PUT', `/v1/accounts/${wallet.id}`, {
      name: 'Wallet',
      type: 'cash',
      currency: 'PLN',
      openingBalance: 0,
      archived: true,
    })

    await restoreExpense(mock, dinner.id)

    expect(await itemOf(mock, dinner.id)).toMatchObject({ change: 'new', suggestedAccountId: null })
  })

  it('keeps the records when Anna is unlinked or the group is deleted', async () => {
    const mock = api()
    await thisIsMe(mock)
    const before = (await balanceOf(mock, CASH)) as number
    await confirmSuggested(mock, await itemOf(mock, 'gex_dinner'), CASH)

    await unlink(mock)

    expect((await list(mock)).total).toBe(0)
    expect(amountsFor(mock, 'gex_dinner')).toEqual([[3_000, 12_900]])
    expect(await balanceOf(mock, CASH)).toBe(before - 51_600)

    await thisIsMe(mock)
    expect((await list(mock)).items.map((item) => item.entryId)).toEqual(['gpay_kasia_anna'])

    await send(mock, 'DELETE', groupPath())

    expect((await list(mock)).total).toBe(0)
    expect(amountsFor(mock, 'gex_dinner')).toEqual([[3_000, 12_900]])
    expect(legsFor(mock, 'gex_dinner')).toEqual([[CASH, day(-10), -38_700]])
    expect(await balanceOf(mock, CASH)).toBe(before - 51_600)
  })

  it('confirms into the archived account that holds the records, and no other archived account', async () => {
    const mock = api()
    await thisIsMe(mock)
    const wallet = await addAccount(mock)
    const archived = await addAccount(mock, { name: 'Old', archived: true })
    const dinner = await addExpense(mock, { date: day(-2) })
    await confirmSuggested(mock, await itemOf(mock, dinner.id), wallet.id)
    await send(mock, 'PUT', `/v1/accounts/${wallet.id}`, {
      name: 'Wallet',
      type: 'cash',
      currency: 'PLN',
      openingBalance: 0,
      archived: true,
    })
    await editExpense(mock, dinner.id, { date: day(-2), amount: 16_000 })
    const changed = await itemOf(mock, dinner.id)

    expect(changed.suggestedAccountId).toBe(wallet.id)
    await refused(confirmSuggested(mock, changed, archived.id), { accountId: ['validation.archivedAccount'] })
    expect(await confirmSuggested(mock, changed, wallet.id)).toBeUndefined()

    expect(amountsFor(mock, dinner.id)).toEqual([[4_000, 17_200]])
    expect(await balanceOf(mock, wallet.id)).toBe(-68_800)
  })

  it('rejects without booking and asks again only after a change', async () => {
    const mock = api()
    await thisIsMe(mock)
    const before = (await balanceOf(mock, CASH)) as number
    const count = mock.db.state.transactions.length

    expect(
      await reject(mock, 'expenses', 'gex_dinner', { version: (await itemOf(mock, 'gex_dinner')).version, lines: 5 }),
    ).toBeUndefined()

    expect(mock.db.state.transactions).toHaveLength(count)
    expect(mock.db.state.groupLegs).toEqual([])
    expect(await balanceOf(mock, CASH)).toBe(before)
    expect(await findItem(mock, 'gex_dinner')).toBeUndefined()

    await editExpense(mock, 'gex_dinner', { date: day(-10), amount: 15_000 })

    expect(await itemOf(mock, 'gex_dinner')).toMatchObject({
      change: 'new',
      previous: null,
      suggestedAccountId: null,
      current: { amount: 15_000 },
    })
  })
})

describe('confirming a repayment', () => {
  it('books a payment back as the expenses it covers on its date and the rest as a leg', async () => {
    const mock = api()
    await thisIsMe(mock)
    const before = (await balanceOf(mock, CASH)) as number
    const boat = await addRepayment(mock, { fromMemberId: anna, toMemberId: max, amount: 2_000 })
    const extra = await addRepayment(mock, { fromMemberId: anna, toMemberId: max, amount: 3_000 })

    const boatItem = await itemOf(mock, boat.id)
    const extraItem = await itemOf(mock, extra.id)

    expect(Object.keys(boatItem.current ?? {})).toEqual(PAID_TERM_KEYS)
    expect(boatItem).toMatchObject({
      kind: 'repayment',
      change: 'new',
      version: `${mock.db.state.groupEvents.at(-2)?.id}.${anna}`,
      current: {
        direction: 'paid',
        memberId: max,
        amount: 2_000,
        currency: 'EUR',
        date: today,
        groupAmount: 2_000,
        covers: [{ expenseId: 'gex_boat', groupAmount: 2_000 }],
      },
      other: 0,
      lines: [
        {
          expenseId: 'gex_boat',
          description: 'Boat trip',
          amount: 2_000,
          currency: 'EUR',
          suggestion: { categoryId: categoryOf('leisure'), newCategory: null, title: 'Boat trip', tags: [] },
        },
      ],
    })
    expect(extraItem).toMatchObject({ current: { groupAmount: 3_000, covers: [] }, lines: [], other: 3_000 })

    await confirmSuggested(mock, boatItem, CASH)
    await confirmSuggested(mock, extraItem, CASH)

    expect(
      bookedFor(mock, boat.id).map((row) => [row.date, row.amount, row.currency, row.accountAmount, row.categoryId]),
    ).toEqual([[today, 2_000, 'EUR', 8_600, categoryOf('leisure')]])
    expect(legsFor(mock, boat.id)).toEqual([])
    expect(bookedFor(mock, extra.id)).toEqual([])
    expect(legsFor(mock, extra.id)).toEqual([[CASH, today, -12_900]])
    expect(await balanceOf(mock, CASH)).toBe(before - 21_500)
  })

  it('splits a payment in another currency across its lines and creates a new category once', async () => {
    const mock = api()
    await thisIsMe(mock)
    const taxi = await addExpense(mock, {
      payerId: olya,
      amount: 4_000,
      categoryId: 'transport',
      tags: [],
      description: 'Taxi',
      split: { mode: 'equal', memberIds: [anna, olya] },
    })
    const countBefore = (await expenseCategories(mock)).length
    const payment = await addRepayment(mock, {
      fromMemberId: anna,
      toMemberId: olya,
      amount: 10_000,
      currency: 'PLN',
      rate: 0.25,
    })

    const item = await itemOf(mock, payment.id)

    expect(item).toMatchObject({
      current: {
        amount: 10_000,
        currency: 'PLN',
        groupAmount: 2_500,
        covers: [
          { expenseId: 'gex_groceries', groupAmount: 768 },
          { expenseId: taxi.id, groupAmount: 1_732 },
        ],
      },
      other: 0,
    })
    expect(item.lines.map((line) => [line.expenseId, line.description, line.amount, line.currency])).toEqual([
      ['gex_groceries', 'Groceries', 3_072, 'PLN'],
      [taxi.id, 'Taxi', 6_928, 'PLN'],
    ])
    expect(item.lines.map((line) => line.suggestion.categoryId)).toEqual([
      categoryOf('groceries'),
      categoryOf('transport'),
    ])

    await confirm(mock, 'repayments', payment.id, {
      version: item.version,
      accountId: CASH,
      lines: [{ newCategory: 'Trip costs' }, { newCategory: ' trip COSTS ' }],
    })

    const categories = await expenseCategories(mock)
    expect(categories).toHaveLength(countBefore + 1)
    const created = categories.find((row) => row.name === 'Trip costs')
    expect(
      bookedFor(mock, payment.id).map((row) => [
        row.amount,
        row.currency,
        row.accountAmount,
        row.baseAmount,
        row.categoryId,
      ]),
    ).toEqual([
      [3_072, 'PLN', 3_072, 3_072, created?.id ?? ''],
      [6_928, 'PLN', 6_928, 6_928, created?.id ?? ''],
    ])
    expect(legsFor(mock, payment.id)).toEqual([])
  })

  it('folds a line whose amount or part of the account amount is 0 into the leg', async () => {
    const mock = api()
    await thisIsMe(mock)
    const yen = await addAccount(mock, { name: 'Yen', currency: 'JPY' })
    const coffee = await addExpense(mock, { amount: 100, description: 'Coffee' })
    const coffeeItem = await itemOf(mock, coffee.id)
    expect(coffeeItem).toMatchObject({ current: { share: 25 }, other: 75 })

    await confirmSuggested(mock, coffeeItem, yen.id, 1)

    expect(bookedFor(mock, coffee.id)).toEqual([])
    expect(legsFor(mock, coffee.id)).toEqual([[yen.id, today, -1]])

    const payment = await addRepayment(mock, {
      fromMemberId: anna,
      toMemberId: olya,
      amount: 1,
      currency: 'JPY',
      rate: 20,
    })
    const paymentItem = await itemOf(mock, payment.id)
    expect(paymentItem).toMatchObject({
      current: { groupAmount: 2_000, covers: [{ expenseId: 'gex_groceries', groupAmount: 768 }] },
      lines: [{ expenseId: 'gex_groceries', amount: 0, currency: 'JPY' }],
      other: 1,
    })

    await confirmSuggested(mock, paymentItem, CASH, 2)

    expect(bookedFor(mock, payment.id)).toEqual([])
    expect(legsFor(mock, payment.id)).toEqual([[CASH, today, -200]])
  })

  it('receives money back as a leg, never as income', async () => {
    const mock = api()
    await thisIsMe(mock)
    const overviewBefore = await get<OverviewDto>(mock, '/v1/overview')
    const wallet = await addAccount(mock)
    const count = mock.db.state.transactions.length

    await confirmSuggested(mock, await itemOf(mock, 'gpay_kasia_anna'), wallet.id)

    expect(mock.db.state.transactions).toHaveLength(count)
    expect(legsFor(mock, 'gpay_kasia_anna')).toEqual([[wallet.id, day(-7), 8_600]])
    expect((await accounts(mock)).find((account) => account.id === wallet.id)).toMatchObject({
      balance: 8_600,
      inUse: true,
    })
    const overview = await get<OverviewDto>(mock, '/v1/overview')
    expect(overview.income.amount).toBe(overviewBefore.income.amount)
    expect(overview.expense.amount).toBe(overviewBefore.expense.amount)
    expect(overview.balance.amount).toBe(overviewBefore.balance.amount + 8_600)
    await refused(send(mock, 'DELETE', `/v1/accounts/${wallet.id}`), { id: ['validation.accountInUse'] })
    await refused(
      send(mock, 'PUT', `/v1/accounts/${wallet.id}`, {
        name: 'Wallet',
        type: 'cash',
        currency: 'EUR',
        openingBalance: 0,
      }),
      { currency: ['validation.currencyLocked'] },
    )
  })

  it('asks again when only the manual rate of a payment changes', async () => {
    const mock = api()
    await thisIsMe(mock)
    const body = { fromMemberId: anna, toMemberId: olya, amount: 20_000, currency: 'PLN', rate: 0.25 }
    const payment = await addRepayment(mock, body)
    await confirmSuggested(mock, await itemOf(mock, payment.id), CASH)
    expect(await findItem(mock, payment.id)).toBeUndefined()

    await send(mock, 'PUT', groupPath(`/repayments/${payment.id}`), { ...body, date: today, rate: 0.2 })

    const item = await itemOf(mock, payment.id)
    expect(item).toMatchObject({
      change: 'changed',
      previous: { groupAmount: 5_000 },
      current: {
        amount: 20_000,
        currency: 'PLN',
        groupAmount: 4_000,
        covers: [{ expenseId: 'gex_groceries', groupAmount: 768 }],
      },
      other: 16_160,
      suggestedAccountId: CASH,
    })
    expect(item.lines.map((line) => line.amount)).toEqual([3_840])
  })
})

describe('category keys', () => {
  it('seeds the starter key on every starter category and none on the others', () => {
    const mock = api()
    const keyOf = (id: string) => mock.db.state.categories.find((row) => row.id === id)?.standardKey

    expect(keyOf(categoryOf('cafes'))).toBe('cafes')
    expect(keyOf(categoryOf('transfer'))).toBe('transfer')
    expect(keyOf('cat_anna_income_salary')).toBe('salary')
    expect(keyOf('cat_anna_income_other')).toBe('other')
    expect(keyOf('cat_anna_expense_sport')).toBeNull()
    expect(keyOf('cat_oleh_expense_cafes')).toBe('cafes')
  })

  it('gives the starters of a new user their keys, keeps a key on rename and never shows it', async () => {
    const mock = api()
    mock.db.state.categories = mock.db.state.categories.filter((row) => row.userId !== 'usr_anna')

    const categories = await expenseCategories(mock)
    const groceries = mock.db.state.categories.find(
      (row) => row.userId === 'usr_anna' && row.standardKey === 'groceries',
    )
    expect(groceries).toBeDefined()
    expect(Object.keys(categories[0] ?? {}).sort()).toEqual(CATEGORY_KEYS)

    await send(mock, 'PUT', `/v1/categories/${groceries?.id}`, { name: 'Food', kind: 'expense', color: 'chart-1' })
    const created = (await send(mock, 'POST', '/v1/categories', {
      name: 'Books',
      kind: 'expense',
      color: 'chart-2',
    })) as CategoryDto

    expect(mock.db.state.categories.find((row) => row.id === groceries?.id)?.standardKey).toBe('groceries')
    expect(mock.db.state.categories.find((row) => row.id === created.id)?.standardKey).toBeNull()
    expect(Object.keys(created).sort()).toEqual(CATEGORY_KEYS)
  })
})

describe('to confirm checks', () => {
  it('refuses the shape of the body before the entry is looked up', async () => {
    const mock = api()
    await thisIsMe(mock)
    const lines = [
      {},
      { categoryId: 'c', newCategory: 'n' },
      { categoryId: 5 },
      { newCategory: 'x'.repeat(41) },
      { newCategory: 'a\u0007b' },
      { categoryId: 'c', newCategory: 7 },
      { categoryId: 'c', title: 5 },
      { categoryId: 'c', title: 'x'.repeat(101) },
      { categoryId: 'c', title: 'a\u0001b' },
      { categoryId: 'c', tags: 'x' },
      { categoryId: 'c', tags: ['x'.repeat(31)] },
      { categoryId: 'c', title: '   ', tags: null },
    ]
    const lineErrors = {
      'lines.0.categoryId': ['validation.required'],
      'lines.1.categoryId': ['validation.invalidValue'],
      'lines.2.categoryId': ['validation.unknownCategory'],
      'lines.3.newCategory': ['validation.nameTooLong'],
      'lines.4.newCategory': ['validation.invalidValue'],
      'lines.5.categoryId': ['validation.invalidValue'],
      'lines.5.newCategory': ['validation.invalidValue'],
      'lines.6.title': ['validation.invalidValue'],
      'lines.7.title': ['validation.titleTooLong'],
      'lines.8.title': ['validation.invalidValue'],
      'lines.9.tags': ['validation.invalidValue'],
      'lines.10.tags': ['validation.tagTooLong'],
    }

    for (const entryId of ['gex_missing', 'gex_dinner']) {
      await refused(confirm(mock, 'expenses', entryId, { accountId: CASH }), { version: ['validation.required'] })
      await refused(confirm(mock, 'expenses', entryId, { version: 5, accountId: 7, rate: 0, lines: 'x' }), {
        version: ['validation.invalidValue'],
        accountId: ['validation.unknownAccount'],
        rate: ['validation.invalidValue'],
        lines: ['validation.invalidValue'],
      })
      await refused(confirm(mock, 'expenses', entryId, { version: 'v', lines: [{ categoryId: 'c' }, 5] }), {
        lines: ['validation.invalidValue'],
      })
      await refused(confirm(mock, 'expenses', entryId, { version: 'v', rate: 'x', lines }), {
        rate: ['validation.invalidValue'],
        ...lineErrors,
      })
      await refused(reject(mock, 'expenses', entryId, {}), { version: ['validation.required'] })
      await refused(reject(mock, 'expenses', entryId, { version: 5 }), { version: ['validation.invalidValue'] })
    }
    await notFound(confirm(mock, 'expenses', 'gex_missing', { version: 'v', rate: ' ', lines: null }))
    expect(mock.db.state.groupConfirmations).toEqual([])
  })

  it('answers 404 for entries that are not items of the caller', async () => {
    const mock = api()
    const dinnerVersion = 'gevt_gex_dinner_2.gmb_anna'
    const body = { version: dinnerVersion, accountId: CASH, lines: [{ categoryId: categoryOf('cafes') }] }

    await notFound(confirm(mock, 'expenses', 'gex_dinner', body))
    await notFound(reject(mock, 'expenses', 'gex_dinner', { version: dinnerVersion }))

    await thisIsMe(mock)
    for (const [kind, entryId] of [
      ['expenses', 'gex_groceries'],
      ['expenses', 'gex_boat'],
      ['expenses', 'gex_pierogi'],
      ['expenses', 'gex_missing'],
      ['repayments', 'gex_dinner'],
      ['expenses', 'gpay_kasia_anna'],
      ['transfers', 'gex_dinner'],
      ['expense', 'gex_dinner'],
    ] as const) {
      await notFound(confirm(mock, kind, entryId, body))
      await notFound(reject(mock, kind, entryId, { version: dinnerVersion }))
    }

    expect(mock.db.state.groupConfirmations).toEqual([])
    expect((await itemOf(mock, 'gex_dinner')).change).toBe('new')
  })

  it('refuses a stale version with 409 and writes nothing', async () => {
    const mock = api()
    await thisIsMe(mock)
    const stale = await itemOf(mock, 'gex_dinner')
    const count = mock.db.state.transactions.length

    await editExpense(mock, 'gex_dinner', { date: day(-10), amount: 15_000 })

    await itemChanged(confirmSuggested(mock, stale, CASH))
    await itemChanged(reject(mock, 'expenses', 'gex_dinner', { version: stale.version }))
    expect(mock.db.state.groupConfirmations).toEqual([])
    expect(mock.db.state.groupLegs).toEqual([])
    expect(mock.db.state.transactions).toHaveLength(count)
    const current = await itemOf(mock, 'gex_dinner')
    expect(current.change).toBe('new')
    expect(current.version).not.toBe(stale.version)
    expect(current.current).toMatchObject({ amount: 15_000 })
  })

  it('answers 409 when Anna is linked to the other member of a payment since it was listed', async () => {
    const mock = api()
    await thisIsMe(mock)
    const stale = await itemOf(mock, 'gpay_kasia_anna')

    await unlink(mock)
    await thisIsMe(mock, kasia)

    await itemChanged(confirmSuggested(mock, stale, CASH))
    await itemChanged(reject(mock, 'repayments', 'gpay_kasia_anna', { version: stale.version }))
    expect(mock.db.state.groupConfirmations).toEqual([])
    const paid = await itemOf(mock, 'gpay_kasia_anna')
    expect(paid.version).toBe(`gevt_gpay_kasia_anna_1.${kasia}`)
    expect(paid).toMatchObject({
      current: {
        direction: 'paid',
        memberId: anna,
        groupAmount: 2_000,
        covers: [{ expenseId: 'gex_dinner', groupAmount: 2_000 }],
      },
      other: 0,
      lines: [{ expenseId: 'gex_dinner', amount: 2_000, suggestion: { categoryId: categoryOf('cafes') } }],
    })

    await confirmSuggested(mock, paid, CASH)

    expect(bookedFor(mock, 'gpay_kasia_anna').map((row) => [row.date, row.amount, row.accountAmount])).toEqual([
      [day(-7), 2_000, 8_600],
    ])
  })

  it('refuses the references after the version and before any rate', async () => {
    const mock = api()
    await thisIsMe(mock)
    const archived = await addAccount(mock, { name: 'Old', archived: true })
    const item = await itemOf(mock, 'gex_dinner')
    const { version } = item
    const categoriesBefore = mock.db.state.categories.length
    mock.db.state.rates = mock.db.state.rates.filter((row) => row.from !== 'EUR')

    const cases: [unknown, Record<string, string[]>][] = [
      [
        { version, accountId: 'acc_oleh_card', lines: [{ categoryId: categoryOf('transfer') }] },
        { accountId: ['validation.unknownAccount'], 'lines.0.categoryId': ['validation.unknownCategory'] },
      ],
      [
        { version, accountId: archived.id, lines: [{ categoryId: 'cat_anna_income_salary' }] },
        { accountId: ['validation.archivedAccount'], 'lines.0.categoryId': ['validation.unknownCategory'] },
      ],
      [
        { version, accountId: 'acc_missing', lines: [{ categoryId: 'cat_missing' }] },
        { accountId: ['validation.unknownAccount'], 'lines.0.categoryId': ['validation.unknownCategory'] },
      ],
      [
        { version, accountId: CASH, lines: [{ newCategory: 'przelewy' }] },
        { 'lines.0.newCategory': ['validation.categoryNameTaken'] },
      ],
      [{ version, lines: [{ categoryId: categoryOf('cafes') }] }, { accountId: ['validation.required'] }],
      [{ version, accountId: CASH }, { lines: ['validation.invalidValue'] }],
      [{ version, accountId: CASH, lines: '  ' }, { lines: ['validation.invalidValue'] }],
      [
        { version, accountId: CASH, lines: [{ categoryId: categoryOf('cafes') }, { categoryId: categoryOf('cafes') }] },
        { lines: ['validation.invalidValue'] },
      ],
      [
        { version, accountId: archived.id, lines: [] },
        { accountId: ['validation.archivedAccount'], lines: ['validation.invalidValue'] },
      ],
    ]
    for (const [body, errors] of cases) await refused(confirm(mock, 'expenses', 'gex_dinner', body), errors)

    await unavailable(confirmSuggested(mock, item, CASH))
    expect(mock.db.state.groupConfirmations).toEqual([])
    expect(mock.db.state.categories).toHaveLength(categoriesBefore)
    expect((await itemOf(mock, 'gex_dinner')).change).toBe('new')
  })

  it('answers 503 without a usable rate and books with a manual one', async () => {
    const mock = api()
    const kuwait = (await send(mock, 'POST', '/v1/groups', {
      name: 'Kuwait',
      currency: 'KWD',
      members: ['Anna', 'Bea', 'Cem'],
    })) as GroupDto
    const me = kuwait.members[0]?.id as string
    await thisIsMe(mock, me, kuwait.id)
    const dinner = await addExpense(
      mock,
      { payerId: me, amount: 6_000, currency: 'KWD', date: day(-2), tags: [] },
      kuwait.id,
    )
    mock.db.state.rates = mock.db.state.rates.filter((row) => row.from !== 'KWD')
    const item = await itemOf(mock, dinner.id)

    await unavailable(confirmSuggested(mock, item, CASH))
    expect(mock.db.state.groupConfirmations).toEqual([])

    expect(await confirmSuggested(mock, item, CASH, 13.5)).toBeUndefined()

    expect(
      bookedFor(mock, dinner.id).map((row) => [row.amount, row.currency, row.accountAmount, row.rate, row.baseAmount]),
    ).toEqual([[2_000, 'KWD', 2_700, 13.5, 2_700]])
    expect(legsFor(mock, dinner.id)).toEqual([[CASH, day(-2), -5_400]])
  })

  it('needs the rate from the account currency into the base currency even for a leg', async () => {
    const mock = api()
    await thisIsMe(mock)
    quoteRate(mock, 'EUR', 4.3, day(-60))
    const item = await itemOf(mock, 'gpay_kasia_anna')

    await unavailable(confirmSuggested(mock, item, EURO, 1.1))
    expect(mock.db.state.groupConfirmations).toEqual([])

    await confirmSuggested(mock, item, CASH, 4.4)

    expect(legsFor(mock, 'gpay_kasia_anna')).toEqual([[CASH, day(-7), 8_800]])
  })

  it('refuses a converted amount of zero or above the maximum', async () => {
    const mock = api()
    await thisIsMe(mock)
    const tiny = await addExpense(mock, { amount: 1, split: { mode: 'equal', memberIds: [anna] } })
    const huge = await addExpense(mock, { amount: 1_000_000 })

    await refused(confirmSuggested(mock, await itemOf(mock, tiny.id), CASH, 0.4), {
      rate: ['validation.positiveAmount'],
    })
    await refused(confirmSuggested(mock, await itemOf(mock, huge.id), CASH, 1_000_000), {
      rate: ['validation.invalidValue'],
    })

    expect(mock.db.state.groupConfirmations).toEqual([])
    expect(mock.db.state.groupLegs).toEqual([])
    expect((await itemOf(mock, tiny.id)).change).toBe('new')
    expect((await itemOf(mock, huge.id)).change).toBe('new')
  })
})
