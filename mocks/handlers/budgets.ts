import type { BudgetCopyResult, BudgetDto, BudgetPage } from '../../app/shared/api/contract'
import { daysLeft, isPeriodKey, periodByKey, periodFor, shiftPeriod, todayIso } from '../../app/shared/period/period'
import { budgetsOf, limitIn, monthStartOf, summarize } from '../budgets'
import { ownCategories } from '../categories'
import type { BudgetRow, MockDb } from '../db'
import { badRequest, notFound } from '../errors'
import { newId } from '../ids'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { baseCurrencyOf } from '../transactions'
import { collectErrors, isMissing, objectBody } from '../validation'

export const BUDGET_LIMIT_MAX = 100_000_000_000

type Fields = Pick<BudgetRow, 'categoryId' | 'period' | 'limit'>

function validateBudget(db: MockDb, userId: string, body: unknown, existing?: BudgetRow): Fields {
  const { categoryId, period, limit } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(period)) errors.add('period', 'validation.required')
  else if (!isPeriodKey(period)) errors.add('period', 'validation.invalidValue')
  if (isMissing(categoryId)) errors.add('categoryId', 'validation.required')
  else {
    const category = ownCategories(db, userId).find((row) => row.id === categoryId)
    if (!category || category.system === 'transfer') errors.add('categoryId', 'validation.unknownCategory')
    else if (category.kind !== 'expense') errors.add('categoryId', 'validation.expenseCategoryOnly')
    else if (
      isPeriodKey(period) &&
      db.state.budgets.some(
        (row) =>
          row.userId === userId && row.id !== existing?.id && row.categoryId === categoryId && row.period === period,
      )
    ) {
      errors.add('categoryId', 'validation.budgetExists')
    }
  }
  if (isMissing(limit)) errors.add('limit', 'validation.required')
  else if (!Number.isSafeInteger(limit) || (limit as number) > BUDGET_LIMIT_MAX) {
    errors.add('limit', 'validation.invalidValue')
  } else if ((limit as number) <= 0) errors.add('limit', 'validation.positiveAmount')
  errors.throwIfAny()
  return { categoryId: categoryId as string, period: period as string, limit: limit as number }
}

const ownBudget = (db: MockDb, userId: string, id: string | undefined): BudgetRow =>
  db.state.budgets.find((row) => row.id === id && row.userId === userId) ?? notFound()

const viewOf = (db: MockDb, userId: string, row: BudgetRow): BudgetDto =>
  budgetsOf(db.state, userId, periodByKey(row.period, monthStartOf(db.state, userId)), todayIso()).find(
    (budget) => budget.id === row.id,
  ) ?? notFound()

function readPeriod(value: unknown): string {
  if (isMissing(value)) badRequest({ period: ['validation.required'] })
  if (!isPeriodKey(value)) badRequest({ period: ['validation.invalidValue'] })
  return value as string
}

export function registerBudgetHandlers(router: MockRouter) {
  router.on('GET', '/v1/budgets', ({ db, userId, query }): BudgetPage => {
    if (query.period !== undefined && !isPeriodKey(query.period)) badRequest({ period: ['validation.invalidValue'] })
    const today = todayIso()
    const monthStart = monthStartOf(db.state, userId)
    const period = query.period === undefined ? periodFor(today, monthStart) : periodByKey(query.period, monthStart)
    const budgets = budgetsOf(db.state, userId, period, today)
    return {
      ...paginate(budgets, query, { defaultPageSize: 100, maxPageSize: 100 }),
      period: period.key,
      from: period.from,
      to: period.to,
      currency: baseCurrencyOf(db.state, userId),
      summary: summarize(budgets, daysLeft(period, today)),
    }
  })

  router.on('POST', '/v1/budgets', ({ db, userId, body }) => {
    const row: BudgetRow = {
      id: newId('bud'),
      userId,
      currency: baseCurrencyOf(db.state, userId),
      ...validateBudget(db, userId, body),
    }
    db.state.budgets.push(row)
    db.save()
    return viewOf(db, userId, row)
  })

  router.on('POST', '/v1/budgets/copy', ({ db, userId, body }): BudgetCopyResult => {
    const target = readPeriod(objectBody(body).period)
    const source = shiftPeriod(target, -1, monthStartOf(db.state, userId))
    const base = baseCurrencyOf(db.state, userId)
    const own = db.state.budgets.filter((row) => row.userId === userId)
    const taken = new Set(own.filter((row) => row.period === target).map((row) => row.categoryId))
    const copies = own
      .filter((row) => row.period === source.key && !taken.has(row.categoryId))
      .map(
        (row): BudgetRow => ({
          id: newId('bud'),
          userId,
          categoryId: row.categoryId,
          period: target,
          limit: limitIn(db.state, row, base, source),
          currency: base,
        }),
      )
    if (copies.length === 0) badRequest({ period: ['validation.nothingToCopy'] })
    db.state.budgets.push(...copies)
    db.save()
    return { copied: copies.length }
  })

  router.on('PUT', '/v1/budgets/:id', ({ db, userId, params, body }) => {
    const row = ownBudget(db, userId, params.id)
    Object.assign(row, validateBudget(db, userId, body, row), { currency: baseCurrencyOf(db.state, userId) })
    db.save()
    return viewOf(db, userId, row)
  })

  router.on('DELETE', '/v1/budgets/:id', ({ db, userId, params }) => {
    const row = ownBudget(db, userId, params.id)
    db.state.budgets = db.state.budgets.filter((budget) => budget.id !== row.id)
    db.save()
  })
}
