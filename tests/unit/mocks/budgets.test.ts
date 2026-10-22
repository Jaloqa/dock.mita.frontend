import { describe, expect, it } from 'bun:test'
import type { BudgetDto, BudgetPage, CategoryDto, Page } from '../../../app/shared/api/contract'
import { convertMinor } from '../../../app/shared/money/money'
import { addDaysIso, daysLeft, periodByKey, periodFor, shiftPeriod, todayIso } from '../../../app/shared/period/period'
import type { MockApi } from '../../../mocks/api'
import { budgetStatus, perDayHint } from '../../../mocks/budgets'
import { rateOn } from '../../../mocks/rates'
import { loggedInMockApi } from './session'

const today = todayIso()
const current = periodFor(today, 1)
const previous = shiftPeriod(current.key, -1, 1)
const next = shiftPeriod(current.key, 1, 1)
const groceries = 'cat_anna_expense_groceries'
const cafes = 'cat_anna_expense_cafes'
const other = 'cat_anna_expense_other'

const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)
const field = (name: string, code: string) => ({ problem: { status: 400, errors: { [name]: [code] } } })

const api = (): MockApi => {
  const mock = loggedInMockApi()
  mock.db.state.transactions = []
  mock.db.state.budgets = []
  return mock
}

const list = (mock: MockApi, period?: string) =>
  mock.handle({
    method: 'GET',
    path: '/v1/budgets',
    query: period === undefined ? undefined : { period },
  }) as Promise<BudgetPage>
const create = (mock: MockApi, body: unknown) =>
  mock.handle({ method: 'POST', path: '/v1/budgets', body }) as Promise<BudgetDto>
const update = (mock: MockApi, id: string, body: unknown) =>
  mock.handle({ method: 'PUT', path: `/v1/budgets/${id}`, body }) as Promise<BudgetDto>
const remove = (mock: MockApi, id: string) => mock.handle({ method: 'DELETE', path: `/v1/budgets/${id}` })
const copy = (mock: MockApi, body: unknown) => mock.handle({ method: 'POST', path: '/v1/budgets/copy', body })
const spend = (mock: MockApi, categoryId: string, amount: number, date = current.from) =>
  mock.handle({
    method: 'POST',
    path: '/v1/transactions',
    body: { kind: 'expense', date, categoryId, accountId: 'acc_anna_card', amount, currency: 'PLN' },
  })
const annaSettings = (mock: MockApi) => {
  const settings = mock.db.state.settings.find((row) => row.userId === 'usr_anna')
  if (!settings) throw new Error('Anna has no settings')
  return settings
}

describe('budget rules', () => {
  it('derives the status from the share of the limit spent', () => {
    expect(budgetStatus(0, 10_000)).toBe('on_track')
    expect(budgetStatus(8_499, 10_000)).toBe('on_track')
    expect(budgetStatus(8_500, 10_000)).toBe('almost_spent')
    expect(budgetStatus(10_000, 10_000)).toBe('almost_spent')
    expect(budgetStatus(10_001, 10_000)).toBe('over_budget')
  })

  it('spreads the remaining amount over the days left', () => {
    expect(perDayHint(206_430, 18)).toBe(11_468)
    expect(perDayHint(100, 3)).toBe(33)
    expect(perDayHint(0, 10)).toBeNull()
    expect(perDayHint(-500, 10)).toBeNull()
    expect(perDayHint(1_000, 0)).toBeNull()
  })
})

describe('budgets', () => {
  it('counts expenses of the category inside the financial period only', async () => {
    const mock = api()
    const budget = await create(mock, { categoryId: groceries, period: current.key, limit: 100_000 })
    expect(budget).toMatchObject({
      categoryId: groceries,
      period: current.key,
      limit: 100_000,
      spent: 0,
      remaining: 100_000,
      status: 'on_track',
    })
    expect(budget.id).toStartWith('bud_')
    await spend(mock, groceries, 30_000)
    await spend(mock, groceries, 20_000, today)
    await spend(mock, groceries, 99_000, addDaysIso(current.from, -1))
    await spend(mock, cafes, 5_000)
    await mock.handle({
      method: 'POST',
      path: '/v1/transactions',
      body: {
        kind: 'income',
        date: current.from,
        categoryId: 'cat_anna_income_salary',
        accountId: 'acc_anna_card',
        amount: 70_000,
        currency: 'PLN',
      },
    })
    const page = await list(mock, current.key)
    const days = daysLeft(current, today)
    expect(page).toMatchObject({
      period: current.key,
      from: current.from,
      to: current.to,
      currency: 'PLN',
      total: 1,
      summary: { planned: 100_000, spent: 50_000, left: 50_000, daysLeft: days },
    })
    expect(page.items[0]).toMatchObject({
      id: budget.id,
      spent: 50_000,
      remaining: 50_000,
      status: 'on_track',
      perDay: Math.floor(50_000 / days),
    })
  })

  it('reports almost spent and over budget with the overspend as a negative remainder', async () => {
    const mock = api()
    await create(mock, { categoryId: groceries, period: current.key, limit: 10_000 })
    await create(mock, { categoryId: cafes, period: current.key, limit: 10_000 })
    await spend(mock, groceries, 9_000)
    await spend(mock, cafes, 12_500)
    const page = await list(mock, current.key)
    expect(page.items.map((budget) => [budget.categoryId, budget.status, budget.remaining])).toEqual([
      [groceries, 'almost_spent', 1_000],
      [cafes, 'over_budget', -2_500],
    ])
    expect(page.items[1]?.perDay).toBeNull()
    expect(page.summary).toMatchObject({ planned: 20_000, spent: 21_500, left: -1_500 })
  })

  it('has no days left in a past period and the whole length in a future one', async () => {
    const mock = api()
    await create(mock, { categoryId: groceries, period: previous.key, limit: 10_000 })
    await create(mock, { categoryId: groceries, period: next.key, limit: 10_000 })
    const past = await list(mock, previous.key)
    expect(past.summary.daysLeft).toBe(0)
    expect(past.items[0]?.perDay).toBeNull()
    const future = await list(mock, next.key)
    expect(future.summary.daysLeft).toBe(daysLeft(next, next.from))
    expect(future.items[0]?.perDay).toBe(Math.floor(10_000 / future.summary.daysLeft))
  })

  it('defaults to the current period and rejects malformed period keys', async () => {
    const mock = api()
    expect((await list(mock)).period).toBe(current.key)
    for (const period of ['2026-13', '26-10', 'abc', '2026-10-01', '0000-01']) {
      expect(await failure(list(mock, period))).toMatchObject(field('period', 'validation.invalidValue'))
    }
  })

  it('validates category, period and limit', async () => {
    const mock = api()
    expect(await failure(create(mock, {}))).toMatchObject({
      problem: {
        status: 400,
        errors: {
          categoryId: ['validation.required'],
          period: ['validation.required'],
          limit: ['validation.required'],
        },
      },
    })
    const valid = { categoryId: groceries, period: current.key, limit: 10_000 }
    const cases: [Record<string, unknown>, string, string][] = [
      [{ categoryId: 'cat_anna_income_salary' }, 'categoryId', 'validation.expenseCategoryOnly'],
      [{ categoryId: 'cat_anna_expense_transfer' }, 'categoryId', 'validation.unknownCategory'],
      [{ categoryId: 'cat_oleh_expense_groceries' }, 'categoryId', 'validation.unknownCategory'],
      [{ categoryId: 'cat_missing' }, 'categoryId', 'validation.unknownCategory'],
      [{ period: '2026-13' }, 'period', 'validation.invalidValue'],
      [{ limit: 0 }, 'limit', 'validation.positiveAmount'],
      [{ limit: -100 }, 'limit', 'validation.positiveAmount'],
      [{ limit: 10.5 }, 'limit', 'validation.invalidValue'],
      [{ limit: '100' }, 'limit', 'validation.invalidValue'],
      [{ limit: 100_000_000_001 }, 'limit', 'validation.invalidValue'],
    ]
    for (const [patch, name, code] of cases) {
      expect(await failure(create(mock, { ...valid, ...patch }))).toMatchObject(field(name, code))
    }
    expect(mock.db.state.budgets).toHaveLength(0)
  })

  it('allows one budget per category and period', async () => {
    const mock = api()
    const first = await create(mock, { categoryId: groceries, period: current.key, limit: 10_000 })
    expect(await failure(create(mock, { categoryId: groceries, period: current.key, limit: 20_000 }))).toMatchObject(
      field('categoryId', 'validation.budgetExists'),
    )
    await create(mock, { categoryId: groceries, period: previous.key, limit: 20_000 })
    const second = await create(mock, { categoryId: cafes, period: current.key, limit: 5_000 })
    expect(
      await failure(update(mock, second.id, { categoryId: groceries, period: current.key, limit: 5_000 })),
    ).toMatchObject(field('categoryId', 'validation.budgetExists'))
    expect(await update(mock, first.id, { categoryId: groceries, period: current.key, limit: 15_000 })).toMatchObject({
      id: first.id,
      limit: 15_000,
    })
  })

  it('updates and deletes own budgets only', async () => {
    const mock = api()
    const budget = await create(mock, { categoryId: groceries, period: current.key, limit: 10_000 })
    mock.db.state.activeUserId = 'usr_oleh'
    expect((await list(mock, current.key)).items).toEqual([])
    expect(
      await failure(
        update(mock, budget.id, { categoryId: 'cat_oleh_expense_groceries', period: current.key, limit: 1 }),
      ),
    ).toMatchObject({ problem: { status: 404 } })
    expect(await failure(remove(mock, budget.id))).toMatchObject({ problem: { status: 404 } })
    mock.db.state.activeUserId = 'usr_anna'
    await remove(mock, budget.id)
    expect((await list(mock, current.key)).items).toEqual([])
    expect(await failure(remove(mock, budget.id))).toMatchObject({ problem: { status: 404 } })
  })

  it('copies the previous period without touching categories that already have a budget', async () => {
    const mock = api()
    await create(mock, { categoryId: groceries, period: previous.key, limit: 10_000 })
    await create(mock, { categoryId: cafes, period: previous.key, limit: 5_000 })
    await create(mock, { categoryId: cafes, period: current.key, limit: 7_000 })
    expect(await copy(mock, { period: current.key })).toEqual({ copied: 1 })
    expect((await list(mock, current.key)).items.map((budget) => [budget.categoryId, budget.limit])).toEqual([
      [cafes, 7_000],
      [groceries, 10_000],
    ])
    expect(await failure(copy(mock, { period: current.key }))).toMatchObject(
      field('period', 'validation.nothingToCopy'),
    )
    expect(await failure(copy(mock, { period: 'x' }))).toMatchObject(field('period', 'validation.invalidValue'))
    expect(await failure(copy(mock, {}))).toMatchObject(field('period', 'validation.required'))
  })

  it('moves budgets of a deleted category to "other" and merges limits that would collide', async () => {
    const mock = api()
    const books = (await mock.handle({
      method: 'POST',
      path: '/v1/categories',
      body: { name: 'Książki', kind: 'expense', color: 'chart-4' },
    })) as CategoryDto
    await create(mock, { categoryId: books.id, period: previous.key, limit: 10_000 })
    await create(mock, { categoryId: books.id, period: current.key, limit: 4_000 })
    await create(mock, { categoryId: other, period: current.key, limit: 6_000 })
    const categories = (await mock.handle({ method: 'GET', path: '/v1/categories' })) as Page<CategoryDto>
    expect(categories.items.find((category) => category.id === books.id)?.inUse).toBe(true)
    await spend(mock, books.id, 1_500)
    await mock.handle({ method: 'DELETE', path: `/v1/categories/${books.id}` })
    expect((await list(mock, current.key)).items).toMatchObject([{ categoryId: other, limit: 10_000, spent: 1_500 }])
    expect((await list(mock, previous.key)).items).toMatchObject([{ categoryId: other, limit: 10_000 }])
    expect(mock.db.state.budgets.filter((row) => row.categoryId === books.id)).toEqual([])
  })

  it('keeps budgets consistent when the base currency changes', async () => {
    const mock = api()
    const budget = await create(mock, { categoryId: groceries, period: current.key, limit: 100_000 })
    await spend(mock, groceries, 40_000)
    annaSettings(mock).baseCurrency = 'EUR'
    const toEur = rateOn(mock.db.state.rates, current.from, 'PLN', 'EUR')
    const page = await list(mock, current.key)
    expect(page.currency).toBe('EUR')
    expect(page.items[0]).toMatchObject({
      limit: convertMinor(100_000, toEur, 'PLN', 'EUR'),
      spent: convertMinor(40_000, toEur, 'PLN', 'EUR'),
    })
    expect((await update(mock, budget.id, { categoryId: groceries, period: current.key, limit: 30_000 })).limit).toBe(
      30_000,
    )
    annaSettings(mock).baseCurrency = 'PLN'
    const toPln = rateOn(mock.db.state.rates, current.from, 'EUR', 'PLN')
    expect((await list(mock, current.key)).items[0]?.limit).toBe(convertMinor(30_000, toPln, 'EUR', 'PLN'))
  })

  it('re-ranges the same period key when the month start changes', async () => {
    const mock = api()
    await create(mock, { categoryId: groceries, period: current.key, limit: 100_000 })
    await spend(mock, groceries, 10_000, current.from)
    annaSettings(mock).monthStartDay = 10
    const shifted = periodByKey(current.key, 10)
    const page = await list(mock, current.key)
    expect(page).toMatchObject({ period: current.key, from: shifted.from, to: shifted.to })
    expect(page.items[0]?.spent).toBe(0)
    await spend(mock, groceries, 7_000, shifted.from)
    expect((await list(mock, current.key)).items[0]?.spent).toBe(7_000)
    expect((await list(mock)).period).toBe(periodFor(today, 10).key)
  })
})
