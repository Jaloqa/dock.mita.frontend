import { describe, expect, it } from 'bun:test'
import type { AccountDto, DebtDto, DebtPage, DebtRepaymentDto, Page } from '../../../app/shared/api/contract'
import type { Currency } from '../../../app/shared/money/currencies'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import type { MockApi } from '../../../mocks/api'
import type { RateRow } from '../../../mocks/db'
import { priceDebt, priceRepayment } from '../../../mocks/debts'
import { MockHttpError } from '../../../mocks/errors'
import { oneYearAhead } from '../../../mocks/handlers/transfers'
import { accountBalances } from '../../../mocks/ledger'
import { loggedInMockApi, quoteRate } from './session'

const today = todayIso()
const day = (offset: number) => addDaysIso(today, offset)

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
  mock.db.state.debts = []
  mock.db.state.debtRepayments = []
  quoteRate(mock, 'EUR', 4.2563, today)
  return mock
}

const addAccount = async (mock: MockApi, currency: Currency = 'PLN', openingBalance = 0, archived = false) =>
  (
    (await mock.handle({
      method: 'POST',
      path: '/v1/accounts',
      body: { name: `Wallet ${currency}`, type: 'cash', currency, openingBalance, archived },
    })) as AccountDto
  ).id

const balances = (mock: MockApi, userId = 'usr_anna') => accountBalances(mock.db.state, userId)

const debtBody = (patch: Record<string, unknown> = {}) => ({
  direction: 'lent',
  counterparty: 'Max',
  amount: 50_000,
  currency: 'PLN',
  date: today,
  ...patch,
})

const create = (mock: MockApi, patch: Record<string, unknown> = {}) =>
  mock.handle({ method: 'POST', path: '/v1/debts', body: debtBody(patch) }) as Promise<DebtDto>
const createRaw = (mock: MockApi, body: unknown) =>
  mock.handle({ method: 'POST', path: '/v1/debts', body }) as Promise<DebtDto>
const edit = (mock: MockApi, id: string, patch: Record<string, unknown> = {}) =>
  mock.handle({ method: 'PUT', path: `/v1/debts/${id}`, body: debtBody(patch) }) as Promise<DebtDto>
const remove = (mock: MockApi, id: string) => mock.handle({ method: 'DELETE', path: `/v1/debts/${id}` })
const list = (mock: MockApi, query: Record<string, string> = {}) =>
  mock.handle({ method: 'GET', path: '/v1/debts', query }) as Promise<DebtPage>
const repay = (mock: MockApi, id: string, patch: Record<string, unknown> = {}) =>
  mock.handle({
    method: 'POST',
    path: `/v1/debts/${id}/repayments`,
    body: { date: today, amount: 10_000, currency: 'PLN', ...patch },
  }) as Promise<DebtDto>
const repayments = (mock: MockApi, id: string, query: Record<string, string> = {}) =>
  mock.handle({ method: 'GET', path: `/v1/debts/${id}/repayments`, query }) as Promise<Page<DebtRepaymentDto>>
const removeRepayment = (mock: MockApi, id: string, repaymentId: string) =>
  mock.handle({ method: 'DELETE', path: `/v1/debts/${id}/repayments/${repaymentId}` })
const onlyRepayment = async (mock: MockApi, id: string) => {
  const page = await repayments(mock, id)
  expect(page.items).toHaveLength(1)
  return page.items[0] as DebtRepaymentDto
}
const debtOf = async (mock: MockApi, id: string, status = 'open') =>
  (await list(mock, { status })).items.find((item) => item.id === id)

const rates: RateRow[] = [
  { date: today, from: 'EUR', to: 'PLN', value: 4.2563 },
  { date: today, from: 'USD', to: 'PLN', value: 3.9012 },
  { date: today, from: 'JPY', to: 'PLN', value: 0.024764 },
]

const thrown = (action: () => unknown): unknown => {
  try {
    action()
  } catch (error) {
    return error
  }
  return undefined
}

const debtKeys = [
  'accountAmount',
  'accountId',
  'amount',
  'counterparty',
  'currency',
  'date',
  'direction',
  'dueDate',
  'id',
  'note',
  'overdue',
  'rate',
  'remaining',
  'repaid',
  'repayments',
  'status',
]

describe('debt pricing', () => {
  const price = (patch: Partial<Parameters<typeof priceDebt>[1]> = {}) =>
    priceDebt(rates, { date: today, today, amount: 5_000, currency: 'EUR', accountCurrency: 'PLN', ...patch })

  it('uses the stored rate when the currency differs from the account', () => {
    expect(price()).toEqual({ rate: 4.2563, accountAmount: 21_282 })
  })

  it('uses the manual rate when given and rounds it to six decimals', () => {
    expect(price({ rate: 4.5 })).toEqual({ rate: 4.5, accountAmount: 22_500 })
    expect(price({ amount: 1_000_000, rate: 4.1234565 })).toEqual({ rate: 4.123457, accountAmount: 4_123_457 })
  })

  it('scales to the digits of the account currency', () => {
    expect(price({ amount: 1_500, currency: 'JPY' })).toEqual({ rate: 0.024764, accountAmount: 3_715 })
  })

  it('keeps the amount at rate one when the currency equals the account currency', () => {
    expect(price({ amount: 700, currency: 'PLN', rate: 9 })).toEqual({ rate: 1, accountAmount: 700 })
  })

  it('prices nothing without an account', () => {
    expect(price({ amount: 700, currency: 'PLN', accountCurrency: null, rate: 9 })).toEqual({
      rate: null,
      accountAmount: null,
    })
  })

  it('answers 503 when the debt currency has no usable rate', () => {
    expect(thrown(() => price({ currency: 'KWD' }))).toMatchObject({ problem: { status: 503 } })
    expect(thrown(() => price({ date: day(40), today: day(80) }))).toMatchObject({ problem: { status: 503 } })
  })
})

describe('repayment pricing', () => {
  const price = (patch: Partial<Parameters<typeof priceRepayment>[1]> = {}) =>
    priceRepayment(rates, {
      date: today,
      today,
      amount: 5_000,
      currency: 'EUR',
      debtCurrency: 'PLN',
      accountCurrency: 'EUR',
      ...patch,
    })

  it('converts to the debt currency and credits an account in the repayment currency with the amount', () => {
    expect(price()).toEqual({ rate: 4.2563, debtAmount: 21_282, accountAmount: 5_000 })
  })

  it('credits an account in the debt currency with the debt amount', () => {
    expect(price({ accountCurrency: 'PLN' })).toEqual({ rate: 4.2563, debtAmount: 21_282, accountAmount: 21_282 })
  })

  it('credits an account in a third currency at the cross rate of the date and rounds it', () => {
    expect(price({ accountCurrency: 'USD' })).toEqual({ rate: 4.2563, debtAmount: 21_282, accountAmount: 5_455 })
  })

  it('never lets a manual rate replace the cross conversion of the account', () => {
    expect(price({ accountCurrency: 'USD', rate: 4 })).toEqual({ rate: 4, debtAmount: 20_000, accountAmount: 5_455 })
  })

  it('uses the manual rate for the debt when the account is in the repayment currency', () => {
    expect(price({ rate: 4 })).toEqual({ rate: 4, debtAmount: 20_000, accountAmount: 5_000 })
  })

  it('rounds a manual rate to six decimals', () => {
    expect(price({ amount: 1_000_000, accountCurrency: null, rate: 4.1234565 })).toEqual({
      rate: 4.123457,
      debtAmount: 4_123_457,
      accountAmount: null,
    })
  })

  it('moves no money without an account', () => {
    expect(price({ accountCurrency: null })).toEqual({ rate: 4.2563, debtAmount: 21_282, accountAmount: null })
  })

  it('uses rate one in the debt currency even when a rate is given', () => {
    expect(price({ amount: 1_000, currency: 'PLN', accountCurrency: 'PLN', rate: 7 })).toEqual({
      rate: 1,
      debtAmount: 1_000,
      accountAmount: 1_000,
    })
  })

  it('scales a yen repayment to the digits of a zloty debt', () => {
    expect(price({ amount: 1_500, currency: 'JPY', accountCurrency: null })).toEqual({
      rate: 0.024764,
      debtAmount: 3_715,
      accountAmount: null,
    })
  })

  it('answers 503 when a needed rate is missing, also behind a manual rate for a third-currency account', () => {
    expect(thrown(() => price({ currency: 'KWD' }))).toMatchObject({ problem: { status: 503 } })
    expect(thrown(() => price({ accountCurrency: 'KWD', rate: 4 }))).toMatchObject({ problem: { status: 503 } })
  })

  it('needs no stored rate for a manual rate without an account', () => {
    expect(price({ currency: 'KWD', accountCurrency: null, rate: 4 })).toMatchObject({ rate: 4 })
  })
})

describe('creating debts', () => {
  it('lends from an account and answers the debt', async () => {
    const mock = api()
    const account = await addAccount(mock, 'PLN', 100_000)
    const created = await create(mock, { counterparty: '  Max ', dueDate: day(10), accountId: account })
    expect(Object.keys(created).sort()).toEqual(debtKeys)
    expect(created).toMatchObject({
      direction: 'lent',
      counterparty: 'Max',
      amount: 50_000,
      currency: 'PLN',
      repaid: 0,
      remaining: 50_000,
      status: 'open',
      overdue: false,
      date: today,
      dueDate: day(10),
      accountId: account,
      accountAmount: 50_000,
      rate: 1,
      note: null,
      repayments: 0,
    })
    expect(created.id).toStartWith('debt_')
    expect(balances(mock).get(account)).toBe(50_000)
    const accounts = (await mock.handle({ method: 'GET', path: '/v1/accounts' })) as Page<AccountDto>
    expect(accounts.items.find((item) => item.id === account)).toMatchObject({ balance: 50_000, inUse: true })
  })

  it('borrows into an account', async () => {
    const mock = api()
    const account = await addAccount(mock, 'PLN', 100_000)
    const created = await create(mock, {
      direction: 'borrowed',
      counterparty: 'Mum',
      amount: 20_000,
      note: '  Rent  ',
      accountId: account,
    })
    expect(created).toMatchObject({ direction: 'borrowed', note: 'Rent', dueDate: null })
    expect(balances(mock).get(account)).toBe(120_000)
  })

  it('keeps every balance when the debt has no account and ignores a sent rate', async () => {
    const mock = api()
    const account = await addAccount(mock, 'PLN', 100_000)
    const created = await create(mock, { amount: 5_000, currency: 'EUR', rate: 3 })
    expect(created).toMatchObject({
      accountId: null,
      accountAmount: null,
      rate: null,
      currency: 'EUR',
      amount: 5_000,
    })
    expect(balances(mock).get(account)).toBe(100_000)
  })

  it('prices the account amount with the rate of the date unless a rate is given', async () => {
    const mock = api()
    const stored = await addAccount(mock)
    const manual = await addAccount(mock)
    expect(await create(mock, { amount: 5_000, currency: 'EUR', accountId: stored })).toMatchObject({
      rate: 4.2563,
      accountAmount: 21_282,
      amount: 5_000,
    })
    expect(await create(mock, { amount: 5_000, currency: 'EUR', rate: 4.5, accountId: manual })).toMatchObject({
      rate: 4.5,
      accountAmount: 22_500,
    })
    expect(balances(mock).get(stored)).toBe(-21_282)
    expect(balances(mock).get(manual)).toBe(-22_500)
  })

  it('refuses an automatic conversion from a rate older than 30 days and writes nothing', async () => {
    const mock = api()
    quoteRate(mock, 'EUR', 4.2563, day(-40))
    const account = await addAccount(mock)
    await unavailable(create(mock, { amount: 5_000, currency: 'EUR', accountId: account }))
    expect(mock.db.state.debts).toHaveLength(0)
    expect(await create(mock, { amount: 5_000, currency: 'EUR', rate: 4.5, accountId: account })).toMatchObject({
      accountAmount: 22_500,
    })
  })

  it('refuses a converted amount that rounds to zero or is too large', async () => {
    const mock = api()
    quoteRate(mock, 'JPY', 0.00001, today)
    const account = await addAccount(mock)
    await refused(create(mock, { amount: 10, currency: 'JPY', accountId: account }), {
      rate: ['validation.positiveAmount'],
    })
    await refused(create(mock, { amount: 1_000, currency: 'EUR', rate: 1_000_000_000, accountId: account }), {
      rate: ['validation.invalidValue'],
    })
    expect(mock.db.state.debts).toHaveLength(0)
  })

  it('refuses an unknown, foreign or archived account', async () => {
    const mock = api()
    const archived = await addAccount(mock, 'PLN', 0, true)
    await refused(create(mock, { accountId: 'acc_oleh_card' }), { accountId: ['validation.unknownAccount'] })
    await refused(create(mock, { accountId: 'acc_missing' }), { accountId: ['validation.unknownAccount'] })
    await refused(create(mock, { accountId: archived }), { accountId: ['validation.archivedAccount'] })
    expect(mock.db.state.debts).toHaveLength(0)
  })

  it('reports every invalid field in one answer', async () => {
    const mock = api()
    const error = await problemOf(
      create(mock, { direction: 'gift', counterparty: '   ', amount: 0, currency: 'XDR', dueDate: day(-1) }),
    )
    expect(error.errors).toEqual({
      direction: ['validation.invalidValue'],
      counterparty: ['validation.required'],
      amount: ['validation.positiveAmount'],
      currency: ['validation.invalidValue'],
      dueDate: ['validation.dueBeforeDate'],
    })
  })

  it('reports every required field when the body is missing', async () => {
    const error = await problemOf(createRaw(api(), undefined))
    expect(error.errors).toEqual({
      direction: ['validation.required'],
      counterparty: ['validation.required'],
      amount: ['validation.required'],
      currency: ['validation.required'],
      date: ['validation.required'],
    })
  })

  describe('validation rows', () => {
    const valid = (account: string) => ({
      direction: 'lent',
      counterparty: 'Max',
      amount: 50_000,
      currency: 'PLN',
      date: today,
      dueDate: day(10),
      accountId: account,
      rate: 4.5,
      note: 'Trip',
    })

    const invalid: [string, unknown, string][] = [
      ['direction', null, 'validation.required'],
      ['direction', ' ', 'validation.required'],
      ['direction', 'gift', 'validation.invalidValue'],
      ['direction', 'Lent', 'validation.invalidValue'],
      ['direction', 1, 'validation.invalidValue'],
      ['counterparty', null, 'validation.required'],
      ['counterparty', '   ', 'validation.required'],
      ['counterparty', 'Ma\u0007x', 'validation.invalidValue'],
      ['counterparty', 5, 'validation.invalidValue'],
      ['counterparty', 'a'.repeat(41), 'validation.nameTooLong'],
      ['amount', null, 'validation.required'],
      ['amount', 0, 'validation.positiveAmount'],
      ['amount', -5, 'validation.positiveAmount'],
      ['amount', 1.5, 'validation.invalidValue'],
      ['amount', '10', 'validation.invalidValue'],
      ['amount', 100_000_000_001, 'validation.invalidValue'],
      ['currency', null, 'validation.required'],
      ['currency', 'XDR', 'validation.invalidValue'],
      ['currency', 'pln', 'validation.invalidValue'],
      ['date', null, 'validation.required'],
      ['date', '2026-02-30', 'validation.invalidValue'],
      ['date', 20261018, 'validation.invalidValue'],
      ['dueDate', 'x', 'validation.invalidValue'],
      ['dueDate', 5, 'validation.invalidValue'],
      ['dueDate', day(-1), 'validation.dueBeforeDate'],
      ['accountId', '1', 'validation.unknownAccount'],
      ['accountId', 42, 'validation.unknownAccount'],
      ['rate', 0, 'validation.invalidValue'],
      ['rate', -1, 'validation.invalidValue'],
      ['rate', '4', 'validation.invalidValue'],
      ['rate', 1_000_000_001, 'validation.invalidValue'],
      ['note', 5, 'validation.invalidValue'],
      ['note', 'a\u0000', 'validation.invalidValue'],
      ['note', 'a'.repeat(201), 'validation.noteTooLong'],
    ]

    const accepted: [string, unknown][] = [
      ['direction', 'borrowed'],
      ['counterparty', 'a'.repeat(40)],
      ['counterparty', `  ${'a'.repeat(40)}  `],
      ['amount', 100_000_000_000],
      ['amount', 5.0],
      ['currency', 'KWD'],
      ['dueDate', today],
      ['dueDate', null],
      ['dueDate', ''],
      ['accountId', null],
      ['rate', 1e-9],
      ['rate', 1_000_000_000],
      ['rate', null],
      ['note', `  ${'a'.repeat(200)}  `],
      ['note', '   '],
      ['note', null],
    ]

    it('accepts the complete body', async () => {
      const mock = api()
      expect(await createRaw(mock, valid(await addAccount(mock)))).toMatchObject({ counterparty: 'Max', note: 'Trip' })
    })

    it('accepts a body without the optional fields', async () => {
      const mock = api()
      const { dueDate: _dueDate, accountId: _accountId, rate: _rate, note: _note, ...required } = valid('')
      expect(await createRaw(mock, required)).toMatchObject({ dueDate: null, accountId: null, note: null })
    })

    it.each(invalid)('reports %s %p as %s', async (field, value, code) => {
      const mock = api()
      await refused(createRaw(mock, { ...valid(await addAccount(mock)), [field]: value }), { [field]: [code] })
      expect(mock.db.state.debts).toHaveLength(0)
    })

    it.each(accepted)('accepts %s %p', async (field, value) => {
      const mock = api()
      await createRaw(mock, { ...valid(await addAccount(mock)), [field]: value })
      expect(mock.db.state.debts).toHaveLength(1)
    })

    it.each(['direction', 'counterparty', 'amount', 'currency', 'date'])('requires %s', async (field) => {
      const mock = api()
      await refused(createRaw(mock, { ...valid(await addAccount(mock)), [field]: undefined }), {
        [field]: ['validation.required'],
      })
    })

    it('accepts a date one year ahead and refuses a later one', async () => {
      const mock = api()
      const { dueDate: _dueDate, ...body } = valid(await addAccount(mock))
      await createRaw(mock, { ...body, date: oneYearAhead(today) })
      await refused(createRaw(mock, { ...body, date: addDaysIso(oneYearAhead(today), 1) }), {
        date: ['validation.dateTooFar'],
      })
    })

    it('still compares the due date with a date that is only too far ahead', async () => {
      const mock = api()
      await refused(createRaw(mock, { ...valid(await addAccount(mock)), date: addDaysIso(oneYearAhead(today), 1) }), {
        date: ['validation.dateTooFar'],
        dueDate: ['validation.dueBeforeDate'],
      })
    })

    it('skips the due date comparison when the date is invalid', async () => {
      const mock = api()
      await refused(createRaw(mock, { ...valid(await addAccount(mock)), date: 'x' }), {
        date: ['validation.invalidValue'],
      })
    })

    it('answers 400 for the first failing rule of every field at once', async () => {
      const mock = api()
      await refused(createRaw(mock, { ...valid(await addAccount(mock)), direction: 'gift', counterparty: '' }), {
        direction: ['validation.invalidValue'],
        counterparty: ['validation.required'],
      })
    })

    it('reports an unknown account together with the other invalid fields', async () => {
      await refused(createRaw(api(), { ...valid('acc_missing'), amount: 0 }), {
        amount: ['validation.positiveAmount'],
        accountId: ['validation.unknownAccount'],
      })
    })
  })
})

describe('listing debts', () => {
  it('lists open debts by due date with the summary of every open debt', async () => {
    const mock = api()
    quoteRate(mock, 'EUR', 4.3, today)
    const start = day(-10)
    const lentPln = await create(mock, { amount: 40_000, date: start, dueDate: day(5) })
    const lentEur = await create(mock, { amount: 5_000, currency: 'EUR', date: start })
    const borrowed = await create(mock, {
      direction: 'borrowed',
      amount: 150_000,
      date: start,
      dueDate: day(-1),
    })
    const settled = await create(mock, { amount: 12_000, date: start })
    await repay(mock, settled.id, { amount: 12_000 })

    const open = await list(mock)
    expect(Object.keys(open).sort()).toEqual(['currency', 'items', 'page', 'pageSize', 'summary', 'total'])
    expect(open).toMatchObject({ page: 1, pageSize: 100, total: 3, currency: 'PLN' })
    expect(open.items.map((item) => item.id)).toEqual([borrowed.id, lentPln.id, lentEur.id])
    expect(open.items.map((item) => item.overdue)).toEqual([true, false, false])
    expect(open.items[0]?.direction).toBe('borrowed')
    expect(open.items[2]).toMatchObject({ dueDate: null, currency: 'EUR' })
    expect(open.summary).toEqual({ owedToMe: 61_500, owedByMe: 150_000, open: 3, overdue: 1, groups: 0 })

    const closed = await list(mock, { status: 'settled' })
    expect(closed.total).toBe(1)
    expect(closed.items).toHaveLength(1)
    expect(closed.items[0]).toMatchObject({
      id: settled.id,
      status: 'settled',
      remaining: 0,
      repaid: 12_000,
      overdue: false,
      repayments: 1,
    })
    expect(closed.summary).toEqual({ owedToMe: 61_500, owedByMe: 150_000, open: 3, overdue: 1, groups: 0 })
  })

  it('breaks due date ties by date, then by creation, and puts undated debts last', async () => {
    const mock = api()
    const due = day(30)
    const older = await create(mock, { amount: 1_000, date: day(-20), dueDate: due })
    const newer = await create(mock, { amount: 2_000, date: day(-5), dueDate: due })
    const sooner = await create(mock, { amount: 3_000, date: day(-30), dueDate: day(1) })
    const undated = await create(mock, { direction: 'borrowed', amount: 4_000 })
    const sameDay = await create(mock, { amount: 5_000, date: day(-5), dueDate: due })
    expect((await list(mock)).items.map((item) => item.id)).toEqual([
      sooner.id,
      sameDay.id,
      newer.id,
      older.id,
      undated.id,
    ])
  })

  it('orders settled debts by date and creation, newest first', async () => {
    const mock = api()
    const first = await create(mock, { amount: 1_000, date: day(-3) })
    const second = await create(mock, { amount: 1_000, date: day(-3) })
    const older = await create(mock, { amount: 1_000, date: day(-9) })
    for (const debt of [first, second, older]) await repay(mock, debt.id, { amount: 1_000 })
    expect((await list(mock, { status: 'settled' })).items.map((item) => item.id)).toEqual([
      second.id,
      first.id,
      older.id,
    ])
    expect((await list(mock)).items).toEqual([])
  })

  it('pages the debts and summarizes every open debt on every page', async () => {
    const mock = api()
    for (const index of [0, 1, 2]) await create(mock, { amount: 1_000, date: day(-index) })
    const page = await list(mock, { page: '2', pageSize: '2' })
    expect(page).toMatchObject({ total: 3, page: 2, pageSize: 2 })
    expect(page.items).toHaveLength(1)
    expect(page.summary).toEqual({ owedToMe: 3_000, owedByMe: 0, open: 3, overdue: 0, groups: 0 })
  })

  it('converts the remaining amount of each currency once, not debt by debt', async () => {
    const mock = api()
    await create(mock, { amount: 1, currency: 'EUR' })
    await create(mock, { amount: 1, currency: 'EUR' })
    expect((await list(mock)).summary).toMatchObject({ owedToMe: 9, open: 2 })
  })

  it('counts only what is still owed after repayments', async () => {
    const mock = api()
    const debt = await create(mock, { amount: 50_000 })
    await repay(mock, debt.id, { amount: 20_000 })
    expect((await list(mock)).summary).toEqual({ owedToMe: 30_000, owedByMe: 0, open: 1, overdue: 0, groups: 0 })
  })

  it('does not count a debt due today as overdue', async () => {
    const mock = api()
    await create(mock, { dueDate: today })
    await create(mock, { date: day(-3), dueDate: day(-1) })
    expect((await list(mock)).summary).toMatchObject({ open: 2, overdue: 1 })
  })

  it('reports an unknown status or invalid paging as invalidValue under its parameter', async () => {
    const mock = api()
    await refused(list(mock, { status: 'Open' }), { status: ['validation.invalidValue'] })
    await refused(list(mock, { status: '' }), { status: ['validation.invalidValue'] })
    await refused(list(mock, { pageSize: '101' }), { pageSize: ['validation.invalidValue'] })
    await refused(list(mock, { page: '0' }), { page: ['validation.invalidValue'] })
  })

  it('answers 503 when an open debt needs a currency that has no stored rate, whatever the status', async () => {
    const mock = api()
    mock.db.state.rates = mock.db.state.rates.filter((row) => row.from !== 'KWD')
    const debt = await create(mock, { amount: 5_000, currency: 'KWD' })
    await unavailable(list(mock))
    await unavailable(list(mock, { status: 'settled' }))
    await repay(mock, debt.id, { amount: 5_000, currency: 'KWD', rate: 1 })
    expect((await list(mock)).summary).toEqual({ owedToMe: 0, owedByMe: 0, open: 0, overdue: 0, groups: 0 })
  })

  it('values the summary at the latest stored rate whatever its age', async () => {
    const mock = api()
    await create(mock, { amount: 5_000, currency: 'EUR' })
    quoteRate(mock, 'EUR', 4.3, day(-90))
    expect((await list(mock)).summary.owedToMe).toBe(21_500)
  })

  it('returns zeros without debts', async () => {
    expect((await list(api())).summary).toEqual({ owedToMe: 0, owedByMe: 0, open: 0, overdue: 0, groups: 0 })
  })

  it('isolates users', async () => {
    const mock = api()
    quoteRate(mock, 'UAH', 0.1, today)
    const account = await addAccount(mock, 'PLN', 10_000)
    await create(mock, { amount: 3_000, accountId: account })
    await create(mock, { direction: 'borrowed', amount: 1_000 })
    expect((await list(mock)).summary).toEqual({ owedToMe: 3_000, owedByMe: 1_000, open: 2, overdue: 0, groups: 0 })
    mock.db.state.activeUserId = 'usr_oleh'
    for (const status of ['open', 'settled']) {
      const page = await list(mock, { status })
      expect(page).toMatchObject({ total: 0, items: [], currency: 'UAH' })
      expect(page.summary).toEqual({ owedToMe: 200_000, owedByMe: 0, open: 0, overdue: 0, groups: 1 })
    }
  })
})

describe('repayments', () => {
  const lendFromAccount = async (mock: MockApi) => {
    const account = await addAccount(mock, 'PLN', 100_000)
    const debt = await create(mock, { accountId: account })
    return { account, debt }
  }

  it('reduces the remaining amount, moves the money and answers the updated debt', async () => {
    const mock = api()
    const { account, debt } = await lendFromAccount(mock)
    expect(balances(mock).get(account)).toBe(50_000)
    const updated = await repay(mock, debt.id, { accountId: account })
    expect(updated).toMatchObject({
      id: debt.id,
      repaid: 10_000,
      remaining: 40_000,
      status: 'open',
      repayments: 1,
    })
    expect(Object.keys(updated).sort()).toEqual(debtKeys)
    expect(balances(mock).get(account)).toBe(60_000)
    const row = await onlyRepayment(mock, debt.id)
    expect(Object.keys(row).sort()).toEqual([
      'accountAmount',
      'accountId',
      'amount',
      'currency',
      'date',
      'debtAmount',
      'id',
      'note',
      'rate',
    ])
    expect(row).toMatchObject({
      date: today,
      amount: 10_000,
      currency: 'PLN',
      rate: 1,
      debtAmount: 10_000,
      accountId: account,
      accountAmount: 10_000,
      note: null,
    })
  })

  it('refuses one minor unit more than the remaining amount and writes nothing', async () => {
    const mock = api()
    const { account, debt } = await lendFromAccount(mock)
    await repay(mock, debt.id, { accountId: account })
    await refused(repay(mock, debt.id, { amount: 40_001, accountId: account }), {
      amount: ['validation.exceedsRemaining'],
    })
    expect(mock.db.state.debtRepayments).toHaveLength(1)
    expect(mock.db.state.debts[0]?.repaid).toBe(10_000)
    expect(balances(mock).get(account)).toBe(60_000)
  })

  it('settles the debt when the remaining amount is repaid exactly and refuses more, also on a settled debt', async () => {
    const mock = api()
    const debt = await create(mock, { dueDate: day(-1), date: day(-5) })
    expect((await debtOf(mock, debt.id))?.overdue).toBe(true)
    const settled = await repay(mock, debt.id, { amount: 50_000 })
    expect(settled).toMatchObject({ status: 'settled', remaining: 0, overdue: false })
    expect(await debtOf(mock, debt.id)).toBeUndefined()
    expect(await debtOf(mock, debt.id, 'settled')).toBeDefined()
    await refused(repay(mock, debt.id, { amount: 1 }), { amount: ['validation.exceedsRemaining'] })
    expect(mock.db.state.debtRepayments).toHaveLength(1)
  })

  it('converts a repayment in another currency into the debt currency and the account', async () => {
    const mock = api()
    const euro = await addAccount(mock, 'EUR')
    const zloty = await addAccount(mock)
    const intoEuro = await create(mock)
    const intoZloty = await create(mock)
    const overridden = await create(mock)
    const eur = { amount: 5_000, currency: 'EUR' }

    expect((await repay(mock, intoEuro.id, { ...eur, accountId: euro })).repaid).toBe(21_282)
    expect(await onlyRepayment(mock, intoEuro.id)).toMatchObject({
      amount: 5_000,
      currency: 'EUR',
      rate: 4.2563,
      debtAmount: 21_282,
      accountId: euro,
      accountAmount: 5_000,
    })
    await repay(mock, intoZloty.id, { ...eur, accountId: zloty })
    expect(await onlyRepayment(mock, intoZloty.id)).toMatchObject({ debtAmount: 21_282, accountAmount: 21_282 })
    expect((await repay(mock, overridden.id, { ...eur, accountId: zloty, rate: 4 })).repaid).toBe(20_000)
    expect(await onlyRepayment(mock, overridden.id)).toMatchObject({
      rate: 4,
      debtAmount: 20_000,
      accountAmount: 20_000,
    })
    expect(balances(mock).get(euro)).toBe(5_000)
    expect(balances(mock).get(zloty)).toBe(41_282)
  })

  it('credits an account in a third currency at the cross rate of the date, whatever manual rate is given', async () => {
    const mock = api()
    quoteRate(mock, 'USD', 3.9012, today)
    const dollar = await addAccount(mock, 'USD')
    const automatic = await create(mock)
    const overridden = await create(mock)
    const eur = { amount: 5_000, currency: 'EUR', accountId: dollar }
    await repay(mock, automatic.id, eur)
    await repay(mock, overridden.id, { ...eur, rate: 4 })
    expect(await onlyRepayment(mock, automatic.id)).toMatchObject({ debtAmount: 21_282, accountAmount: 5_455 })
    expect(await onlyRepayment(mock, overridden.id)).toMatchObject({ debtAmount: 20_000, accountAmount: 5_455 })
    expect(balances(mock).get(dollar)).toBe(10_910)
  })

  it('takes money out of the account when a borrowed debt is repaid', async () => {
    const mock = api()
    const account = await addAccount(mock)
    const debt = await create(mock, { direction: 'borrowed', amount: 100_000, accountId: account })
    expect(balances(mock).get(account)).toBe(100_000)
    expect(await repay(mock, debt.id, { amount: 30_000, accountId: account })).toMatchObject({ remaining: 70_000 })
    expect(balances(mock).get(account)).toBe(70_000)
  })

  it('keeps every balance when the repayment has no account', async () => {
    const mock = api()
    const { account, debt } = await lendFromAccount(mock)
    await repay(mock, debt.id)
    expect(await onlyRepayment(mock, debt.id)).toMatchObject({ accountId: null, accountAmount: null })
    expect(balances(mock).get(account)).toBe(50_000)
  })

  it('refuses an automatic conversion from a stale rate but takes a manual rate for the debt', async () => {
    const mock = api()
    quoteRate(mock, 'EUR', 4.2563, day(-40))
    const account = await addAccount(mock)
    const debt = await create(mock)
    await unavailable(repay(mock, debt.id, { amount: 5_000, currency: 'EUR', accountId: account }))
    expect(mock.db.state.debtRepayments).toHaveLength(0)
    expect(mock.db.state.debts[0]?.repaid).toBe(0)
    expect(await repay(mock, debt.id, { amount: 5_000, currency: 'EUR', accountId: account, rate: 4.5 })).toMatchObject(
      { repaid: 22_500 },
    )
  })

  it('answers 503 before refusing an amount above the remaining one', async () => {
    const mock = api()
    quoteRate(mock, 'EUR', 4.2563, day(-40))
    const debt = await create(mock, { amount: 1_000 })
    await unavailable(repay(mock, debt.id, { amount: 5_000, currency: 'EUR' }))
  })

  it('refuses a converted amount that rounds to zero', async () => {
    const mock = api()
    quoteRate(mock, 'JPY', 0.03, today)
    const yen = await addAccount(mock, 'JPY')
    const debt = await create(mock)
    await refused(repay(mock, debt.id, { amount: 10, currency: 'JPY', rate: 0.00001 }), {
      rate: ['validation.positiveAmount'],
    })
    await refused(repay(mock, debt.id, { amount: 1, accountId: yen }), { rate: ['validation.positiveAmount'] })
    expect(mock.db.state.debtRepayments).toHaveLength(0)
  })

  it('refuses a converted amount that is too large before comparing it with the remaining amount', async () => {
    const mock = api()
    const debt = await create(mock)
    await refused(repay(mock, debt.id, { amount: 100_000, currency: 'EUR', rate: 1_000_000_000 }), {
      rate: ['validation.invalidValue'],
    })
    expect(mock.db.state.debtRepayments).toHaveLength(0)
  })

  it('lists the repayments newest first with paging', async () => {
    const mock = api()
    quoteRate(mock, 'EUR', 4.2563, day(-5))
    const account = await addAccount(mock)
    const debt = await create(mock, { amount: 100_000, date: day(-30) })
    await repay(mock, debt.id, { amount: 1_000, date: day(-2), note: '  first  ' })
    await repay(mock, debt.id, { amount: 2_000, date: day(-1), accountId: account })
    await repay(mock, debt.id, { amount: 5_000, currency: 'EUR', accountId: account })

    const page = await repayments(mock, debt.id)
    expect(Object.keys(page).sort()).toEqual(['items', 'page', 'pageSize', 'total'])
    expect(page).toMatchObject({ page: 1, pageSize: 100, total: 3 })
    expect(page.items).toMatchObject([
      {
        date: today,
        amount: 5_000,
        currency: 'EUR',
        rate: 4.2563,
        debtAmount: 21_282,
        accountId: account,
        accountAmount: 21_282,
        note: null,
      },
      { date: day(-1), amount: 2_000, currency: 'PLN', rate: 1, debtAmount: 2_000, accountAmount: 2_000 },
      { date: day(-2), amount: 1_000, debtAmount: 1_000, accountId: null, accountAmount: null, note: 'first' },
    ])
    expect(page.items[0]).not.toHaveProperty('userId')
    expect(page.items[0]).not.toHaveProperty('debtId')

    const first = await repayments(mock, debt.id, { pageSize: '2' })
    expect(first.items.map((item) => item.id)).toEqual(page.items.slice(0, 2).map((item) => item.id))
    const second = await repayments(mock, debt.id, { page: '2', pageSize: '2' })
    expect(second.items.map((item) => item.id)).toEqual(page.items.slice(2).map((item) => item.id))
  })

  it('breaks repayment date ties by creation, newest first', async () => {
    const mock = api()
    const debt = await create(mock)
    await repay(mock, debt.id, { amount: 1_000 })
    await repay(mock, debt.id, { amount: 2_000 })
    expect((await repayments(mock, debt.id)).items.map((item) => item.amount)).toEqual([2_000, 1_000])
  })

  it('reports invalid paging before looking the debt up', async () => {
    const mock = api()
    await refused(repayments(mock, 'debt_missing', { pageSize: '101' }), { pageSize: ['validation.invalidValue'] })
    await refused(repayments(mock, 'debt_missing', { page: '0' }), { page: ['validation.invalidValue'] })
    await notFound(repayments(mock, 'debt_missing'))
  })

  it('restores the debt and the balance when a repayment is deleted', async () => {
    const mock = api()
    const { account, debt } = await lendFromAccount(mock)
    const other = await create(mock, { amount: 9_000 })
    await repay(mock, other.id, { amount: 4_000 })
    const foreign = await onlyRepayment(mock, other.id)
    await repay(mock, debt.id, { accountId: account })
    expect(balances(mock).get(account)).toBe(60_000)
    const row = await onlyRepayment(mock, debt.id)

    await notFound(removeRepayment(mock, debt.id, foreign.id))
    expect(mock.db.state.debtRepayments).toHaveLength(2)
    expect(mock.db.state.debts.find((item) => item.id === other.id)?.repaid).toBe(4_000)

    expect(await removeRepayment(mock, debt.id, row.id)).toBeUndefined()
    expect(await debtOf(mock, debt.id)).toMatchObject({
      repaid: 0,
      remaining: 50_000,
      repayments: 0,
      status: 'open',
    })
    expect(balances(mock).get(account)).toBe(50_000)
    await notFound(removeRepayment(mock, debt.id, row.id))
    await notFound(removeRepayment(mock, 'debt_missing', row.id))
  })

  it('reopens a settled debt when its repayment is deleted', async () => {
    const mock = api()
    const debt = await create(mock, { direction: 'borrowed', amount: 8_000 })
    await repay(mock, debt.id, { amount: 8_000 })
    const row = await onlyRepayment(mock, debt.id)
    await removeRepayment(mock, debt.id, row.id)
    const open = await list(mock)
    expect(open.items.map((item) => item.id)).toEqual([debt.id])
    expect(open.summary).toEqual({ owedToMe: 0, owedByMe: 8_000, open: 1, overdue: 0, groups: 0 })
  })

  it('answers 404 for the repayments of an unknown or foreign debt and changes nothing', async () => {
    const mock = api()
    const account = await addAccount(mock, 'PLN', 10_000)
    const debt = await create(mock, { amount: 3_000, accountId: account })
    await repay(mock, debt.id, { amount: 1_000, accountId: account })
    const row = await onlyRepayment(mock, debt.id)
    mock.db.state.activeUserId = 'usr_oleh'
    await notFound(repay(mock, debt.id, { amount: 500, accountId: 'acc_oleh_card' }))
    await notFound(repayments(mock, debt.id))
    await notFound(removeRepayment(mock, debt.id, row.id))
    mock.db.state.activeUserId = 'usr_anna'
    expect(mock.db.state.debtRepayments).toHaveLength(1)
    expect(mock.db.state.debts[0]?.repaid).toBe(1_000)
    expect(balances(mock).get(account)).toBe(8_000)
    expect((await repayments(mock, debt.id)).total).toBe(1)
  })

  it('validates the body before looking the debt up', async () => {
    const mock = api()
    await refused(repay(mock, 'debt_missing', { amount: 0 }), { amount: ['validation.positiveAmount'] })
    await notFound(repay(mock, 'debt_missing', { amount: 1_000 }))
  })

  it('reports every invalid field in one answer and reports a missing body', async () => {
    const mock = api()
    const body = { amount: 0, date: 'x', currency: 'XDR' }
    await refused(mock.handle({ method: 'POST', path: '/v1/debts/debt_missing/repayments', body }), {
      amount: ['validation.positiveAmount'],
      currency: ['validation.invalidValue'],
      date: ['validation.invalidValue'],
    })
    await refused(mock.handle({ method: 'POST', path: '/v1/debts/debt_missing/repayments' }), {
      amount: ['validation.required'],
      currency: ['validation.required'],
      date: ['validation.required'],
    })
  })

  describe('validation rows', () => {
    const valid = { date: today, amount: 10_000, currency: 'PLN', rate: 4.5, note: 'Part' }

    const invalid: [string, unknown, string][] = [
      ['amount', null, 'validation.required'],
      ['amount', 0, 'validation.positiveAmount'],
      ['amount', 1.5, 'validation.invalidValue'],
      ['amount', '10', 'validation.invalidValue'],
      ['amount', 100_000_000_001, 'validation.invalidValue'],
      ['currency', null, 'validation.required'],
      ['currency', 'XDR', 'validation.invalidValue'],
      ['date', null, 'validation.required'],
      ['date', '2026-02-30', 'validation.invalidValue'],
      ['date', addDaysIso(oneYearAhead(today), 1), 'validation.dateTooFar'],
      ['rate', 0, 'validation.invalidValue'],
      ['rate', '4', 'validation.invalidValue'],
      ['rate', 1_000_000_001, 'validation.invalidValue'],
      ['accountId', '1', 'validation.unknownAccount'],
      ['accountId', 42, 'validation.unknownAccount'],
      ['note', 5, 'validation.invalidValue'],
      ['note', 'a\u0000', 'validation.invalidValue'],
      ['note', 'a'.repeat(201), 'validation.noteTooLong'],
    ]

    it.each(invalid)('reports %s %p as %s', async (field, value, code) => {
      const mock = api()
      const debt = await create(mock)
      await refused(
        mock.handle({ method: 'POST', path: `/v1/debts/${debt.id}/repayments`, body: { ...valid, [field]: value } }),
        { [field]: [code] },
      )
      expect(mock.db.state.debtRepayments).toHaveLength(0)
    })

    it('accepts a date one year ahead and a null account, rate and note', async () => {
      const mock = api()
      const debt = await create(mock, { amount: 100_000 })
      await repay(mock, debt.id, { date: oneYearAhead(today), accountId: null, rate: null, note: null })
      expect(mock.db.state.debtRepayments).toHaveLength(1)
    })
  })

  it('refuses an archived, unknown or foreign account together with the other fields', async () => {
    const mock = api()
    const archived = await addAccount(mock, 'PLN', 0, true)
    const debt = await create(mock, { amount: 5_000 })
    await refused(repay(mock, debt.id, { amount: 1_000, accountId: archived }), {
      accountId: ['validation.archivedAccount'],
    })
    await refused(repay(mock, debt.id, { amount: 1_000, accountId: 'acc_oleh_card' }), {
      accountId: ['validation.unknownAccount'],
    })
    await refused(repay(mock, debt.id, { amount: 0, accountId: 'acc_missing' }), {
      amount: ['validation.positiveAmount'],
      accountId: ['validation.unknownAccount'],
    })
    expect(mock.db.state.debtRepayments).toHaveLength(0)
  })

  it('reports an unknown account before an amount above the remaining one', async () => {
    const mock = api()
    const debt = await create(mock, { amount: 1_000 })
    await refused(repay(mock, debt.id, { amount: 5_000, accountId: 'acc_missing' }), {
      accountId: ['validation.unknownAccount'],
    })
  })
})

describe('editing and deleting debts', () => {
  it('replaces every field and moves the account leg with it', async () => {
    const mock = api()
    const source = await addAccount(mock, 'PLN', 100_000)
    const target = await addAccount(mock)
    const debt = await create(mock, { amount: 30_000, date: day(-3), dueDate: day(5), accountId: source })
    expect(balances(mock).get(source)).toBe(70_000)
    expect(balances(mock).get(target)).toBe(0)

    const moved = await edit(mock, debt.id, {
      counterparty: '  Anna ',
      amount: 30_000,
      accountId: target,
      note: '  Back by Friday ',
    })
    expect(Object.keys(moved).sort()).toEqual(debtKeys)
    expect(moved).toMatchObject({
      id: debt.id,
      direction: 'lent',
      counterparty: 'Anna',
      amount: 30_000,
      repaid: 0,
      remaining: 30_000,
      status: 'open',
      overdue: false,
      date: today,
      dueDate: null,
      accountId: target,
      accountAmount: 30_000,
      rate: 1,
      note: 'Back by Friday',
      repayments: 0,
    })
    expect(balances(mock).get(source)).toBe(100_000)
    expect(balances(mock).get(target)).toBe(-30_000)

    const detached = await edit(mock, debt.id, { counterparty: 'Anna', rate: 7 })
    expect(detached).toMatchObject({ accountId: null, accountAmount: null, rate: null, note: null })
    expect(balances(mock).get(source)).toBe(100_000)
    expect(balances(mock).get(target)).toBe(0)
    expect((await debtOf(mock, debt.id))?.counterparty).toBe('Anna')
    expect(mock.db.state.debts).toHaveLength(1)
  })

  it('keeps the creation order of an edited debt', async () => {
    const mock = api()
    const first = await create(mock, { amount: 1_000 })
    const second = await create(mock, { amount: 2_000 })
    await edit(mock, first.id, { amount: 3_000 })
    expect((await list(mock)).items.map((item) => item.id)).toEqual([second.id, first.id])
  })

  it('re-prices the account amount with the date rate or the manual rate', async () => {
    const mock = api()
    const account = await addAccount(mock, 'PLN', 100_000)
    const debt = await create(mock, { amount: 5_000, currency: 'EUR', accountId: account })
    expect(balances(mock).get(account)).toBe(78_718)
    const eur = { currency: 'EUR', accountId: account }

    expect(await edit(mock, debt.id, { ...eur, amount: 5_000 })).toMatchObject({
      rate: 4.2563,
      accountAmount: 21_282,
    })
    expect(balances(mock).get(account)).toBe(78_718)
    expect(await edit(mock, debt.id, { ...eur, amount: 6_000, rate: 4.5 })).toMatchObject({
      rate: 4.5,
      accountAmount: 27_000,
      amount: 6_000,
    })
    expect(balances(mock).get(account)).toBe(73_000)
  })

  it('answers the stale-rate error alone, before the checks against the repayments', async () => {
    const mock = api()
    quoteRate(mock, 'KWD', 12.6, day(-40))
    const account = await addAccount(mock)
    const debt = await create(mock, { amount: 30_000 })
    await repay(mock, debt.id, { amount: 10_000 })
    await unavailable(edit(mock, debt.id, { amount: 9_999, currency: 'KWD', accountId: account }))
    expect(mock.db.state.debts[0]).toMatchObject({ amount: 30_000, currency: 'PLN', accountId: null })
  })

  it('answers the converted-amount error alone, before the checks against the repayments', async () => {
    const mock = api()
    quoteRate(mock, 'JPY', 0.00001, today)
    const account = await addAccount(mock)
    const debt = await create(mock, { amount: 30_000 })
    await repay(mock, debt.id, { amount: 10_000 })
    await refused(edit(mock, debt.id, { amount: 5, currency: 'JPY', accountId: account }), {
      rate: ['validation.positiveAmount'],
    })
    await refused(edit(mock, debt.id, { amount: 1_000, currency: 'EUR', rate: 1_000_000_000, accountId: account }), {
      rate: ['validation.invalidValue'],
    })
  })

  it('keeps the account the debt already has when it was archived since, and refuses another archived one', async () => {
    const mock = api()
    const kept = await addAccount(mock, 'PLN', 10_000)
    const otherArchived = await addAccount(mock, 'PLN', 0, true)
    const debt = await create(mock, { amount: 3_000, accountId: kept })
    const row = mock.db.state.accounts.find((account) => account.id === kept)
    if (row) row.archived = true

    expect(await edit(mock, debt.id, { amount: 4_000, accountId: kept })).toMatchObject({
      accountId: kept,
      accountAmount: 4_000,
    })
    await refused(edit(mock, debt.id, { amount: 4_000, accountId: otherArchived }), {
      accountId: ['validation.archivedAccount'],
    })
    expect(mock.db.state.debts[0]?.accountId).toBe(kept)
  })

  it('refuses an unknown or foreign account and leaves the debt as it was', async () => {
    const mock = api()
    const debt = await create(mock, { amount: 3_000 })
    await refused(edit(mock, debt.id, { amount: 3_000, accountId: 'acc_oleh_card' }), {
      accountId: ['validation.unknownAccount'],
    })
    await refused(edit(mock, debt.id, { amount: 3_000, accountId: 'acc_missing' }), {
      accountId: ['validation.unknownAccount'],
    })
    expect(mock.db.state.debts[0]?.accountId).toBeNull()
  })

  it('refuses a currency change once a repayment exists and allows it after the repayment is deleted', async () => {
    const mock = api()
    const debt = await create(mock, { amount: 30_000 })
    await repay(mock, debt.id)
    await refused(edit(mock, debt.id, { amount: 30_000, currency: 'EUR' }), {
      currency: ['validation.debtCurrencyLocked'],
    })
    expect(mock.db.state.debts[0]?.currency).toBe('PLN')
    await removeRepayment(mock, debt.id, (await onlyRepayment(mock, debt.id)).id)
    expect(await edit(mock, debt.id, { amount: 30_000, currency: 'EUR' })).toMatchObject({ currency: 'EUR' })
  })

  it('allows the same currency and a higher amount when repayments exist', async () => {
    const mock = api()
    const debt = await create(mock, { amount: 30_000 })
    await repay(mock, debt.id)
    expect(await edit(mock, debt.id, { counterparty: 'Anna', amount: 40_000 })).toMatchObject({
      amount: 40_000,
      repaid: 10_000,
      remaining: 30_000,
      repayments: 1,
    })
  })

  it('refuses an amount below what was repaid and settles the debt at exactly that amount', async () => {
    const mock = api()
    const debt = await create(mock, { amount: 30_000 })
    await repay(mock, debt.id)
    await refused(edit(mock, debt.id, { amount: 9_999 }), { amount: ['validation.belowRepaid'] })
    expect(mock.db.state.debts[0]).toMatchObject({ amount: 30_000, repaid: 10_000 })
    expect(await edit(mock, debt.id, { amount: 10_000 })).toMatchObject({
      amount: 10_000,
      repaid: 10_000,
      remaining: 0,
      status: 'settled',
    })
  })

  it('reports the locked currency and the amount below what was repaid together', async () => {
    const mock = api()
    const debt = await create(mock, { amount: 30_000 })
    await repay(mock, debt.id)
    await refused(edit(mock, debt.id, { amount: 9_999, currency: 'EUR' }), {
      amount: ['validation.belowRepaid'],
      currency: ['validation.debtCurrencyLocked'],
    })
    expect(mock.db.state.debts[0]).toMatchObject({ amount: 30_000, currency: 'PLN' })
  })

  it('makes the legs of the repayments follow a new direction', async () => {
    const mock = api()
    const account = await addAccount(mock, 'PLN', 100_000)
    const debt = await create(mock, { amount: 30_000, accountId: account })
    await repay(mock, debt.id, { accountId: account })
    expect(balances(mock).get(account)).toBe(80_000)
    expect(await edit(mock, debt.id, { direction: 'borrowed', amount: 30_000, accountId: account })).toMatchObject({
      direction: 'borrowed',
      repaid: 10_000,
    })
    expect(balances(mock).get(account)).toBe(120_000)
  })

  it('validates the body before looking the debt up', async () => {
    const mock = api()
    await refused(edit(mock, 'debt_missing', { amount: 0 }), { amount: ['validation.positiveAmount'] })
    await refused(edit(mock, 'debt_missing', { accountId: 'acc_missing' }), {
      accountId: ['validation.unknownAccount'],
    })
    await notFound(edit(mock, 'debt_missing'))
  })

  it('does not let an unknown debt keep an archived account', async () => {
    const mock = api()
    const archived = await addAccount(mock, 'PLN', 0, true)
    await refused(edit(mock, 'debt_missing', { accountId: archived }), { accountId: ['validation.archivedAccount'] })
  })

  it('deletes the debt with its repayments and restores every balance', async () => {
    const mock = api()
    const source = await addAccount(mock, 'PLN', 100_000)
    const target = await addAccount(mock, 'PLN', 5_000)
    const debt = await create(mock, { amount: 30_000, accountId: source })
    await repay(mock, debt.id, { accountId: target })
    expect(balances(mock).get(source)).toBe(70_000)
    expect(balances(mock).get(target)).toBe(15_000)
    for (const id of [source, target]) {
      await refused(mock.handle({ method: 'DELETE', path: `/v1/accounts/${id}` }), { id: ['validation.accountInUse'] })
    }

    expect(await remove(mock, debt.id)).toBeUndefined()
    expect(balances(mock).get(source)).toBe(100_000)
    expect(balances(mock).get(target)).toBe(5_000)
    expect(await debtOf(mock, debt.id)).toBeUndefined()
    expect(mock.db.state.debtRepayments).toHaveLength(0)
    await notFound(repayments(mock, debt.id))
    for (const id of [source, target]) {
      expect(await mock.handle({ method: 'DELETE', path: `/v1/accounts/${id}` })).toBeUndefined()
    }
  })

  it('answers 404 for an unknown or foreign debt and keeps it', async () => {
    const mock = api()
    const debt = await create(mock, { amount: 3_000 })
    mock.db.state.activeUserId = 'usr_oleh'
    await notFound(edit(mock, debt.id, { amount: 1_000 }))
    await notFound(remove(mock, debt.id))
    await notFound(remove(mock, 'debt_missing'))
    mock.db.state.activeUserId = 'usr_anna'
    expect(mock.db.state.debts[0]).toMatchObject({ amount: 3_000, counterparty: 'Max' })
  })

  it('locks the currency of an account that only a debt uses', async () => {
    const mock = api()
    const account = await addAccount(mock, 'PLN', 1_000)
    await create(mock, { amount: 500, accountId: account })
    await refused(
      mock.handle({
        method: 'PUT',
        path: `/v1/accounts/${account}`,
        body: { name: 'Wallet', type: 'cash', currency: 'EUR', openingBalance: 1_000 },
      }),
      { currency: ['validation.currencyLocked'] },
    )
  })
})

describe('debt legs in the ledger', () => {
  it('nets lent and borrowed debts with their repayments on one account', async () => {
    const mock = api()
    const account = await addAccount(mock, 'PLN', 10_000)
    const lent = await create(mock, { amount: 3_000, accountId: account })
    expect(balances(mock).get(account)).toBe(7_000)
    await repay(mock, lent.id, { amount: 1_000, accountId: account })
    expect(balances(mock).get(account)).toBe(8_000)
    const borrowed = await create(mock, { direction: 'borrowed', amount: 5_000, accountId: account })
    expect(balances(mock).get(account)).toBe(13_000)
    await repay(mock, borrowed.id, { amount: 2_000, accountId: account })
    expect(balances(mock).get(account)).toBe(11_000)
  })

  it('never turns debts into transactions or transfers', async () => {
    const mock = api()
    const account = await addAccount(mock, 'PLN', 10_000)
    const debt = await create(mock, { amount: 3_000, accountId: account })
    await repay(mock, debt.id, { amount: 1_000, accountId: account })
    expect(mock.db.state.transactions.filter((row) => row.accountId === account)).toHaveLength(0)
    const transfers = (await mock.handle({
      method: 'GET',
      path: '/v1/transfers',
      query: { accountId: account },
    })) as Page<unknown>
    expect(transfers.total).toBe(0)
  })
})
