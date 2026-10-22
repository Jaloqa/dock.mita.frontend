import { describe, expect, it } from 'bun:test'
import type { AccountDto, CategoryDto, Page, TransactionDto, TransactionPage } from '../../../app/shared/api/contract'
import { MANUAL_RATE_MAX } from '../../../app/shared/money/currencies'
import { convertMinor } from '../../../app/shared/money/money'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import type { MockApi } from '../../../mocks/api'
import { createDb, type KeyValueStorage, STORAGE_KEY } from '../../../mocks/db'
import { oneYearAhead } from '../../../mocks/handlers/transfers'
import { rateOn } from '../../../mocks/rates'
import { seedState } from '../../../mocks/seed'
import { loggedInMockApi, quoteRate } from './session'

const today = todayIso()
const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)
const field = (name: string, code: string) => ({ problem: { status: 400, errors: { [name]: [code] } } })

const api = (): MockApi => {
  const mock = loggedInMockApi()
  mock.db.state.transactions = []
  return mock
}

const lidl = {
  kind: 'expense',
  date: today,
  title: 'Lidl',
  categoryId: 'cat_anna_expense_groceries',
  accountId: 'acc_anna_card',
  amount: 14_230,
  currency: 'PLN',
}

const create = (mock: MockApi, body: unknown) =>
  mock.handle({ method: 'POST', path: '/v1/transactions', body }) as Promise<TransactionDto>
const list = (mock: MockApi, query?: Record<string, string>) =>
  mock.handle({ method: 'GET', path: '/v1/transactions', query }) as Promise<TransactionPage>
const titles = async (mock: MockApi, query: Record<string, string>) =>
  (await list(mock, query)).items.map((item) => item.title)
const balanceOf = async (mock: MockApi, id: string) =>
  ((await mock.handle({ method: 'GET', path: '/v1/accounts' })) as Page<AccountDto>).items.find(
    (account) => account.id === id,
  )?.balance ?? 0

describe('transactions', () => {
  it('creates an expense in the account currency and lowers the balance', async () => {
    const mock = api()
    const before = await balanceOf(mock, 'acc_anna_card')
    const created = await create(mock, { ...lidl, title: '  Lidl  ', note: '  ' })
    expect(created).toMatchObject({
      kind: 'expense',
      date: today,
      title: 'Lidl',
      note: null,
      amount: 14_230,
      currency: 'PLN',
      accountAmount: 14_230,
      rate: 1,
      baseAmount: 14_230,
    })
    expect(created.id).toStartWith('txn_')
    expect(Object.keys(created).sort()).toEqual([
      'accountAmount',
      'accountId',
      'amount',
      'baseAmount',
      'categoryId',
      'currency',
      'date',
      'id',
      'kind',
      'note',
      'rate',
      'tags',
      'title',
    ])
    expect(await balanceOf(mock, 'acc_anna_card')).toBe(before - 14_230)
  })

  it('adds income to the balance and stores an empty title when none is given', async () => {
    const mock = api()
    const before = await balanceOf(mock, 'acc_anna_card')
    const { title: _title, ...body } = lidl
    const created = await create(mock, {
      ...body,
      kind: 'income',
      categoryId: 'cat_anna_income_salary',
      amount: 740_000,
    })
    expect(created).toMatchObject({ kind: 'income', title: '' })
    expect(await balanceOf(mock, 'acc_anna_card')).toBe(before + 740_000)
  })

  it('converts a EUR payment from a PLN card with the rate of the date unless one is given', async () => {
    const mock = api()
    const date = addDaysIso(today, -3)
    const rate = rateOn(mock.db.state.rates, date, 'EUR', 'PLN')
    const body = { ...lidl, date, currency: 'EUR', amount: 5_000 }
    expect(await create(mock, body)).toMatchObject({
      currency: 'EUR',
      amount: 5_000,
      rate,
      accountAmount: convertMinor(5_000, rate, 'EUR', 'PLN'),
      baseAmount: convertMinor(5_000, rate, 'EUR', 'PLN'),
    })
    expect(await create(mock, { ...body, rate: 4.5 })).toMatchObject({
      rate: 4.5,
      accountAmount: 22_500,
      baseAmount: 22_500,
    })
  })

  it('ignores a client rate when the currencies are equal', async () => {
    expect(await create(api(), { ...lidl, rate: 3 })).toMatchObject({ rate: 1, accountAmount: 14_230 })
  })

  it('converts into the base currency through the account currency', async () => {
    const mock = api()
    const usdEur = rateOn(mock.db.state.rates, today, 'USD', 'EUR')
    const eurPln = rateOn(mock.db.state.rates, today, 'EUR', 'PLN')
    const created = await create(mock, { ...lidl, accountId: 'acc_anna_eur', currency: 'USD', amount: 10_000 })
    const accountAmount = convertMinor(10_000, usdEur, 'USD', 'EUR')
    expect(created).toMatchObject({
      rate: usdEur,
      accountAmount,
      baseAmount: convertMinor(accountAmount, eurPln, 'EUR', 'PLN'),
    })
  })

  it('prices a JPY expense on a PLN account by the minor units of both currencies', async () => {
    const mock = api()
    quoteRate(mock, 'JPY', 0.024764, today)
    expect(await create(mock, { ...lidl, currency: 'JPY', amount: 1_500 })).toMatchObject({
      currency: 'JPY',
      amount: 1_500,
      rate: 0.024764,
      accountAmount: 3_715,
      baseAmount: 3_715,
    })
  })

  it('prices a KWD expense with three fraction digits on a PLN account', async () => {
    const mock = api()
    quoteRate(mock, 'KWD', 12.6221, today)
    expect(await create(mock, { ...lidl, currency: 'KWD', amount: 1_250 })).toMatchObject({
      rate: 12.6221,
      accountAmount: 1_578,
      baseAmount: 1_578,
    })
  })

  it('refuses an automatic conversion from a rate older than 30 days', async () => {
    const mock = api()
    quoteRate(mock, 'KWD', 12.6221, addDaysIso(today, -40))
    expect(await failure(create(mock, { ...lidl, currency: 'KWD', amount: 1_250 }))).toMatchObject({
      problem: { status: 503, code: 'rates.unavailable' },
    })
    expect(mock.db.state.transactions).toHaveLength(0)
  })

  it('accepts a rate exactly 30 days old and refuses one 31 days old', async () => {
    const mock = api()
    quoteRate(mock, 'KWD', 12.6221, addDaysIso(today, -30))
    expect(await create(mock, { ...lidl, currency: 'KWD', amount: 1_250 })).toMatchObject({ accountAmount: 1_578 })
    quoteRate(mock, 'KWD', 12.6221, addDaysIso(today, -31))
    expect(await failure(create(mock, { ...lidl, currency: 'KWD', amount: 1_250 }))).toMatchObject({
      problem: { status: 503 },
    })
  })

  it('measures the age against the date of a past transaction', async () => {
    const mock = api()
    quoteRate(mock, 'KWD', 12.6221, addDaysIso(today, -40))
    const created = await create(mock, { ...lidl, currency: 'KWD', amount: 1_250, date: addDaysIso(today, -35) })
    expect(created).toMatchObject({ rate: 12.6221, accountAmount: 1_578 })
  })

  it('still converts with a manual rate when the stored rate is stale', async () => {
    const mock = api()
    quoteRate(mock, 'KWD', 12.6221, addDaysIso(today, -40))
    expect(await create(mock, { ...lidl, currency: 'KWD', amount: 1_250, rate: 12.5 })).toMatchObject({
      rate: 12.5,
      accountAmount: 1_563,
      baseAmount: 1_563,
    })
  })

  it('refuses the account to base conversion from a stale rate even with a manual rate', async () => {
    const mock = api()
    const dinar = (await mock.handle({
      method: 'POST',
      path: '/v1/accounts',
      body: { name: 'Dinar', type: 'cash', currency: 'KWD', openingBalance: 0 },
    })) as AccountDto
    quoteRate(mock, 'KWD', 12.6221, addDaysIso(today, -40))
    const body = { ...lidl, accountId: dinar.id, currency: 'KWD', amount: 1_250 }
    expect(await failure(create(mock, { ...body, rate: 2 }))).toMatchObject({
      problem: { status: 503, code: 'rates.unavailable' },
    })
    expect(await create(mock, { ...body, currency: 'PLN', rate: 0.08 })).toMatchObject({
      accountAmount: 1_000,
      baseAmount: 1_250,
    })
  })

  it('rounds a manual rate like the backend and refuses one above the maximum', async () => {
    const mock = api()
    const body = { ...lidl, currency: 'EUR', amount: 1_000 }
    expect(await create(mock, { ...body, rate: 4.25634949 })).toMatchObject({ rate: 4.256349, accountAmount: 4_256 })
    expect(await failure(create(mock, { ...body, rate: MANUAL_RATE_MAX + 1 }))).toMatchObject(
      field('rate', 'validation.invalidValue'),
    )
    expect(await create(mock, { ...body, amount: 1, rate: MANUAL_RATE_MAX })).toMatchObject({
      rate: MANUAL_RATE_MAX,
      accountAmount: 1_000_000_000,
    })
  })

  it('keeps stored amounts when rates change later', async () => {
    const mock = api()
    const created = await create(mock, { ...lidl, currency: 'EUR', amount: 5_000 })
    for (const row of mock.db.state.rates) row.value *= 2
    expect((await list(mock)).items[0]).toMatchObject({
      rate: created.rate,
      accountAmount: created.accountAmount,
      baseAmount: created.baseAmount,
    })
  })

  it('reports base amounts in the current base currency after it changes', async () => {
    const mock = api()
    await create(mock, lidl)
    const settings = mock.db.state.settings.find((row) => row.userId === 'usr_anna')
    if (!settings) throw new Error('seed has no settings for Anna')
    settings.baseCurrency = 'EUR'
    const page = await list(mock)
    const expected = convertMinor(14_230, rateOn(mock.db.state.rates, today, 'PLN', 'EUR'), 'PLN', 'EUR')
    expect(page).toMatchObject({ currency: 'EUR', sum: -expected })
    expect(page.items[0]?.baseAmount).toBe(expected)
  })

  it('validates fields with i18n codes', async () => {
    const mock = api()
    expect(await failure(create(mock, {}))).toMatchObject({
      problem: {
        status: 400,
        errors: {
          kind: ['validation.required'],
          date: ['validation.required'],
          categoryId: ['validation.required'],
          accountId: ['validation.required'],
          amount: ['validation.required'],
          currency: ['validation.required'],
        },
      },
    })
    expect(
      await failure(
        create(mock, {
          ...lidl,
          kind: 'transfer',
          date: '2026-02-30',
          amount: 0,
          currency: 'XDR',
          rate: -1,
          title: 'x'.repeat(101),
          note: 'y'.repeat(201),
        }),
      ),
    ).toMatchObject({
      problem: {
        errors: {
          kind: ['validation.invalidValue'],
          date: ['validation.invalidValue'],
          amount: ['validation.positiveAmount'],
          currency: ['validation.invalidValue'],
          rate: ['validation.invalidValue'],
          title: ['validation.titleTooLong'],
          note: ['validation.noteTooLong'],
        },
      },
    })
    expect(await failure(create(mock, { ...lidl, date: addDaysIso(oneYearAhead(today), 1) }))).toMatchObject(
      field('date', 'validation.dateTooFar'),
    )
    expect(await create(mock, { ...lidl, date: oneYearAhead(today), title: 'z'.repeat(100) })).toMatchObject({
      date: oneYearAhead(today),
    })
    for (const amount of [100_000_000_001, 12.5, '100']) {
      expect(await failure(create(mock, { ...lidl, amount }))).toMatchObject(field('amount', 'validation.invalidValue'))
    }
  })

  it('requires an own category of the same kind and never the transfer category', async () => {
    const mock = api()
    expect(await failure(create(mock, { ...lidl, categoryId: 'cat_anna_income_salary' }))).toMatchObject(
      field('categoryId', 'validation.categoryKindMismatch'),
    )
    for (const categoryId of ['cat_oleh_expense_groceries', 'cat_anna_expense_transfer', 'cat_missing']) {
      expect(await failure(create(mock, { ...lidl, categoryId }))).toMatchObject(
        field('categoryId', 'validation.unknownCategory'),
      )
    }
  })

  it('refuses archived accounts for new transactions but keeps one on edit', async () => {
    const mock = api()
    expect(await failure(create(mock, { ...lidl, accountId: 'acc_oleh_card' }))).toMatchObject(
      field('accountId', 'validation.unknownAccount'),
    )
    const onCash = await create(mock, { ...lidl, accountId: 'acc_anna_cash' })
    const onCard = await create(mock, lidl)
    const cash = mock.db.state.accounts.find((row) => row.id === 'acc_anna_cash')
    if (!cash) throw new Error('seed has no cash account')
    cash.archived = true
    expect(await failure(create(mock, { ...lidl, accountId: 'acc_anna_cash' }))).toMatchObject(
      field('accountId', 'validation.archivedAccount'),
    )
    expect(
      await mock.handle({
        method: 'PUT',
        path: `/v1/transactions/${onCash.id}`,
        body: { ...lidl, accountId: 'acc_anna_cash', title: 'Żabka' },
      }),
    ).toMatchObject({ title: 'Żabka', accountId: 'acc_anna_cash' })
    expect(
      await failure(
        mock.handle({
          method: 'PUT',
          path: `/v1/transactions/${onCard.id}`,
          body: { ...lidl, accountId: 'acc_anna_cash' },
        }),
      ),
    ).toMatchObject(field('accountId', 'validation.archivedAccount'))
  })

  it('reads, updates and deletes an own transaction and returns 404 for others', async () => {
    const mock = api()
    const created = await create(mock, { ...lidl, note: 'Weekly' })
    const path = `/v1/transactions/${created.id}`
    expect(await mock.handle({ method: 'GET', path })).toEqual(created)
    expect(await mock.handle({ method: 'PUT', path, body: { ...lidl, amount: 10_000 } })).toMatchObject({
      id: created.id,
      amount: 10_000,
      accountAmount: 10_000,
      note: null,
    })
    expect(await mock.handle({ method: 'DELETE', path })).toBeUndefined()
    expect(await failure(mock.handle({ method: 'GET', path }))).toMatchObject({ problem: { status: 404 } })
    const foreign = await create(mock, lidl)
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_oleh' } })
    for (const method of ['GET', 'PUT', 'DELETE'] as const) {
      expect(await failure(mock.handle({ method, path: `/v1/transactions/${foreign.id}`, body: lidl }))).toMatchObject({
        problem: { status: 404 },
      })
    }
    expect((await list(mock)).total).toBe(0)
  })

  it('lists newest first with paging, a total and the signed sum in the base currency', async () => {
    const mock = api()
    await create(mock, { ...lidl, date: addDaysIso(today, -2), amount: 1_000 })
    const newest = await create(mock, { ...lidl, amount: 2_000 })
    await create(mock, {
      ...lidl,
      kind: 'income',
      categoryId: 'cat_anna_income_salary',
      date: addDaysIso(today, -1),
      amount: 50_000,
    })
    const page = await list(mock, { pageSize: '2' })
    expect(page).toMatchObject({ page: 1, pageSize: 2, total: 3, sum: 47_000, currency: 'PLN' })
    expect(page.items[0]?.id).toBe(newest.id)
    expect(page.items.map((item) => item.date)).toEqual([today, addDaysIso(today, -1)])
    expect((await list(mock, { page: '2', pageSize: '2' })).items).toHaveLength(1)
    expect(await failure(list(mock, { pageSize: '101' }))).toMatchObject(field('pageSize', 'validation.invalidValue'))
  })

  it('filters by kind, category, account, period and search', async () => {
    const mock = api()
    await create(mock, { ...lidl, date: addDaysIso(today, -40) })
    await create(mock, { ...lidl, title: 'Żabka', accountId: 'acc_anna_cash', amount: 2_460, note: 'Bułki' })
    await create(mock, { ...lidl, title: '', categoryId: 'cat_anna_expense_cafes', amount: 3_600 })
    await create(mock, {
      ...lidl,
      kind: 'income',
      title: 'Pensja',
      categoryId: 'cat_anna_income_salary',
      amount: 740_000,
    })
    expect(await titles(mock, { kind: 'income' })).toEqual(['Pensja'])
    expect(await titles(mock, { categoryId: 'cat_anna_expense_cafes' })).toEqual([''])
    expect(await titles(mock, { accountId: 'acc_anna_cash' })).toEqual(['Żabka'])
    expect(await titles(mock, { from: addDaysIso(today, -41), to: addDaysIso(today, -39) })).toEqual(['Lidl'])
    expect(await titles(mock, { search: ' LIDL ' })).toEqual(['Lidl'])
    expect(await titles(mock, { search: 'bułki' })).toEqual(['Żabka'])
    expect(await titles(mock, { search: 'kawiar' })).toEqual([''])
    expect(await titles(mock, { search: '24,6' })).toEqual(['Żabka'])
    expect(await titles(mock, { search: '7400' })).toEqual(['Pensja'])
    expect(await titles(mock, { search: '24,600' })).toEqual([])
    expect(
      await failure(list(mock, { kind: 'transfer', from: 'yesterday', to: '2026-13-01', sort: 'title' })),
    ).toMatchObject({
      problem: {
        status: 400,
        errors: {
          kind: ['validation.invalidValue'],
          from: ['validation.invalidValue'],
          to: ['validation.invalidValue'],
          sort: ['validation.invalidValue'],
        },
      },
    })
  })

  it('searches an amount written with the fraction digits of its currency', async () => {
    const mock = api()
    quoteRate(mock, 'JPY', 0.024764, today)
    quoteRate(mock, 'KWD', 12.6221, today)
    await create(mock, { ...lidl, title: 'yen', currency: 'JPY', amount: 1_500 })
    await create(mock, { ...lidl, title: 'dinar', currency: 'KWD', amount: 12_500 })
    await create(mock, { ...lidl, title: 'zloty', amount: 1_250 })
    await create(mock, { ...lidl, title: 'big zloty', amount: 12_500 })
    expect(await titles(mock, { search: '15' })).toEqual(['yen'])
    expect(await titles(mock, { search: '1500' })).toEqual(['yen'])
    expect(await titles(mock, { search: '1500.' })).toEqual([])
    expect(await titles(mock, { search: '12.5' })).toEqual(['zloty', 'dinar'])
    expect(await titles(mock, { search: '12,500' })).toEqual(['dinar'])
    expect(await titles(mock, { search: '12.5000' })).toEqual([])
    expect(await titles(mock, { search: '125.00' })).toEqual(['big zloty'])
  })

  it('sorts by date or by the amount in the base currency', async () => {
    const mock = api()
    await create(mock, { ...lidl, title: 'small', amount: 1_000, date: addDaysIso(today, -1) })
    await create(mock, { ...lidl, title: 'euro', currency: 'EUR', amount: 1_000, date: addDaysIso(today, -2) })
    await create(mock, { ...lidl, title: 'big', amount: 3_000 })
    expect(await titles(mock, { sort: '-date' })).toEqual(['big', 'small', 'euro'])
    expect(await titles(mock, { sort: 'date' })).toEqual(['euro', 'small', 'big'])
    expect(await titles(mock, { sort: '-amount' })).toEqual(['euro', 'big', 'small'])
    expect(await titles(mock, { sort: 'amount' })).toEqual(['small', 'big', 'euro'])
  })

  it('marks the category as used and moves transactions to other when it is deleted', async () => {
    const mock = api()
    const created = await create(mock, { ...lidl, categoryId: 'cat_anna_expense_sport' })
    const categories = (await mock.handle({ method: 'GET', path: '/v1/categories' })) as Page<CategoryDto>
    expect(categories.items.find((category) => category.id === 'cat_anna_expense_sport')?.inUse).toBe(true)
    await mock.handle({ method: 'DELETE', path: '/v1/categories/cat_anna_expense_sport' })
    expect(await mock.handle({ method: 'GET', path: `/v1/transactions/${created.id}` })).toMatchObject({
      categoryId: 'cat_anna_expense_other',
    })
  })

  it('keeps an account with transactions from being deleted', async () => {
    const mock = api()
    const account = (await mock.handle({
      method: 'POST',
      path: '/v1/accounts',
      body: { name: 'Travel', type: 'cash', currency: 'EUR', openingBalance: 0 },
    })) as AccountDto
    await create(mock, { ...lidl, accountId: account.id })
    expect(await failure(mock.handle({ method: 'DELETE', path: `/v1/accounts/${account.id}` }))).toMatchObject(
      field('id', 'validation.accountInUse'),
    )
  })

  it('creates tags by name, merges duplicates and reuses the stored spelling', async () => {
    const mock = api()
    const created = await create(mock, { ...lidl, tags: [' Trip ', 'trip', 'food'] })
    expect(created.tags).toMatchObject([{ name: 'food' }, { name: 'Trip' }])
    const trip = created.tags[1]
    const again = await create(mock, { ...lidl, tags: ['TRIP'] })
    expect(again.tags).toEqual([trip])
    expect(mock.db.state.tags.filter((tag) => tag.name.toLowerCase() === 'trip')).toHaveLength(1)
  })

  it('validates tags in order and stores no tag for a rejected create', async () => {
    const mock = api()
    const before = mock.db.state.tags.length
    expect(await failure(create(mock, { ...lidl, tags: 'a' }))).toMatchObject(field('tags', 'validation.invalidValue'))
    expect(await failure(create(mock, { ...lidl, tags: ['a', 1] }))).toMatchObject(
      field('tags', 'validation.invalidValue'),
    )
    expect(await failure(create(mock, { ...lidl, tags: ['a', '  '] }))).toMatchObject(
      field('tags', 'validation.invalidValue'),
    )
    expect(await failure(create(mock, { ...lidl, tags: ['a\nb'] }))).toMatchObject(
      field('tags', 'validation.invalidValue'),
    )
    expect(await failure(create(mock, { ...lidl, tags: ['x'.repeat(31), 1] }))).toMatchObject(
      field('tags', 'validation.invalidValue'),
    )
    expect(await failure(create(mock, { ...lidl, tags: ['x'.repeat(31)] }))).toMatchObject(
      field('tags', 'validation.tagTooLong'),
    )
    const eleven = Array.from({ length: 11 }, (_, index) => `t${index}`)
    expect(await failure(create(mock, { ...lidl, tags: eleven }))).toMatchObject(
      field('tags', 'validation.tooManyTags'),
    )
    const merged = await create(mock, { ...lidl, tags: [...eleven.slice(0, 10), 'T0'] })
    expect(merged.tags).toHaveLength(10)
    expect(await failure(create(mock, { ...lidl, tags: ['fresh'], amount: 0 }))).toMatchObject(
      field('amount', 'validation.positiveAmount'),
    )
    expect(mock.db.state.tags.some((tag) => tag.name === 'fresh')).toBe(false)
    expect(mock.db.state.tags.length).toBe(before + 10)
  })

  it('clears the tags when a PUT omits them', async () => {
    const mock = api()
    const created = await create(mock, { ...lidl, tags: ['trip'] })
    const path = `/v1/transactions/${created.id}`
    expect(await mock.handle({ method: 'PUT', path, body: { ...lidl, tags: ['trip', 'food'] } })).toMatchObject({
      tags: [{ name: 'food' }, { name: 'trip' }],
    })
    expect(await mock.handle({ method: 'PUT', path, body: lidl })).toMatchObject({ tags: [] })
  })

  it('filters by any of the tag ids, counts a doubly tagged row once and searches tag names', async () => {
    const mock = api()
    const both = await create(mock, { ...lidl, title: 'Both', tags: ['a', 'b'] })
    await create(mock, { ...lidl, title: 'Only a', tags: ['a'] })
    await create(mock, { ...lidl, title: 'None' })
    const [a, b] = both.tags
    const ids = `${a?.id},${b?.id}`
    const page = await list(mock, { tagIds: ids })
    expect(page.items.map((item) => item.title).sort()).toEqual(['Both', 'Only a'])
    expect(page.total).toBe(2)
    expect(page.sum).toBe(-2 * 14_230)
    expect(await titles(mock, { tagIds: String(b?.id) })).toEqual(['Both'])
    expect(await titles(mock, { tagIds: 'tag_unknown' })).toEqual([])
    expect(await titles(mock, { tagIds: ' ' })).toHaveLength(3)
    expect(page.items.find((item) => item.title === 'Both')?.tags).toEqual(both.tags)
    await create(mock, { ...lidl, title: 'Plain', tags: ['Zebra'] })
    expect(await titles(mock, { search: ' zeb ' })).toEqual(['Plain'])
    const eleven = Array.from({ length: 11 }, (_, index) => `tag_${index}`).join(',')
    expect(await failure(list(mock, { tagIds: eleven }))).toMatchObject(field('tagIds', 'validation.invalidValue'))
    expect(await failure(list(mock, { tagIds: 'a,,b' }))).toMatchObject(field('tagIds', 'validation.invalidValue'))
  })

  it('finds a seeded row by the name of its tag', async () => {
    const mock = loggedInMockApi()
    expect(await titles(mock, { search: 'barc' })).toContain('Booking.com — hotel Barcelona')
  })

  it('starts from the seed when the stored database has no transactions table', () => {
    const { transactions: _transactions, ...older } = seedState()
    const storage: KeyValueStorage = {
      getItem: (key) => (key === STORAGE_KEY ? JSON.stringify(older) : null),
      setItem: () => {},
    }
    expect(Array.isArray(createDb(storage, seedState).state.transactions)).toBe(true)
  })
})
