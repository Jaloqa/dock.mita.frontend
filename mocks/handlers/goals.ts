import type { GoalPage } from '../../app/shared/api/contract'
import { isIsoDate, isPeriodKey, todayIso } from '../../app/shared/period/period'
import type { AccountRow, GoalContributionRow, GoalRow, MockDb } from '../db'
import { notFound } from '../errors'
import {
  addMonthsToKey,
  amountIn,
  GOAL_DEADLINE_MAX_MONTHS,
  goalsOf,
  goalView,
  monthKeyOf,
  rebaseGoal,
  summarizeGoals,
} from '../goals'
import { newId } from '../ids'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { baseCurrencyOf } from '../transactions'
import { AMOUNT_MAX, checkAccount, transferRow } from '../transfers'
import { collectErrors, isMissing, objectBody } from '../validation'
import { oneYearAhead } from './transfers'

export const GOAL_NAME_MAX = 40

type Errors = ReturnType<typeof collectErrors>
type GoalFields = Pick<GoalRow, 'name' | 'target' | 'deadline' | 'accountId'>

function checkAmount(value: unknown, field: string, errors: Errors): void {
  if (isMissing(value)) errors.add(field, 'validation.required')
  else if (!Number.isSafeInteger(value) || (value as number) > AMOUNT_MAX) errors.add(field, 'validation.invalidValue')
  else if ((value as number) <= 0) errors.add(field, 'validation.positiveAmount')
}

function checkDeadline(value: unknown, today: string, errors: Errors, existing?: GoalRow): void {
  if (isMissing(value)) return
  if (!isPeriodKey(value)) {
    errors.add('deadline', 'validation.invalidValue')
    return
  }
  if (value === existing?.deadline) return
  const current = monthKeyOf(today)
  if (value < current) errors.add('deadline', 'validation.deadlinePast')
  else if (value > addMonthsToKey(current, GOAL_DEADLINE_MAX_MONTHS)) errors.add('deadline', 'validation.invalidValue')
}

function checkLinkedAccount(db: MockDb, userId: string, value: unknown, errors: Errors, existing?: GoalRow): void {
  if (isMissing(value)) return
  const account = db.state.accounts.find((row) => row.id === value && row.userId === userId)
  if (!account) {
    errors.add('accountId', 'validation.unknownAccount')
    return
  }
  if (account.id === existing?.accountId) return
  if (account.type !== 'savings') errors.add('accountId', 'validation.savingsAccountOnly')
  else if (account.archived) errors.add('accountId', 'validation.archivedAccount')
}

function validateGoal(db: MockDb, userId: string, body: unknown, today: string, existing?: GoalRow): GoalFields {
  const { name, target, deadline, accountId } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(name)) errors.add('name', 'validation.required')
  else if (typeof name !== 'string') errors.add('name', 'validation.invalidValue')
  else if (name.trim().length > GOAL_NAME_MAX) errors.add('name', 'validation.nameTooLong')
  checkAmount(target, 'target', errors)
  checkDeadline(deadline, today, errors, existing)
  checkLinkedAccount(db, userId, accountId, errors, existing)
  errors.throwIfAny()
  return {
    name: (name as string).trim(),
    target: target as number,
    deadline: isMissing(deadline) ? null : (deadline as string),
    accountId: isMissing(accountId) ? null : (accountId as string),
  }
}

function recordContribution(
  db: MockDb,
  userId: string,
  goal: GoalRow,
  body: unknown,
  today: string,
): GoalContributionRow {
  const { amount, date, fromAccountId, rate } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(date)) errors.add('date', 'validation.required')
  else if (!isIsoDate(date)) errors.add('date', 'validation.invalidValue')
  else if (date > oneYearAhead(today)) errors.add('date', 'validation.dateTooFar')
  checkAmount(amount, 'amount', errors)
  if (!isMissing(rate) && (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0)) {
    errors.add('rate', 'validation.invalidValue')
  }
  const linked =
    goal.accountId === null
      ? undefined
      : db.state.accounts.find((row) => row.id === goal.accountId && row.userId === userId)
  if (goal.accountId !== null && (!linked || linked.archived)) errors.add('accountId', 'validation.archivedAccount')
  const from =
    goal.accountId !== null || !isMissing(fromAccountId)
      ? checkAccount(db.state, userId, fromAccountId, 'fromAccountId', errors)
      : undefined
  if (from && linked && from.id === linked.id) errors.add('fromAccountId', 'validation.sameAccount')
  errors.throwIfAny()
  const day = date as string
  const value = amount as number
  const base = baseCurrencyOf(db.state, userId)
  const id = newId('gcn')
  if (!linked) {
    return {
      id,
      userId,
      goalId: goal.id,
      date: day,
      amount: value,
      currency: base,
      fromAccountId: from?.id ?? null,
      transferId: null,
      baseAmount: value,
      baseCurrency: base,
    }
  }
  const source = from as AccountRow
  const transfer = transferRow(db.state, userId, {
    date: day,
    from: source,
    to: linked,
    fromAmount: value,
    rate: typeof rate === 'number' ? rate : undefined,
    note: goal.name,
  })
  db.state.transfers.push(transfer)
  return {
    id,
    userId,
    goalId: goal.id,
    date: day,
    amount: value,
    currency: source.currency,
    fromAccountId: source.id,
    transferId: transfer.id,
    baseAmount: amountIn(db.state, transfer.toAmount, linked.currency, base, day),
    baseCurrency: base,
  }
}

const ownGoal = (db: MockDb, userId: string, id: string | undefined): GoalRow =>
  db.state.goals.find((row) => row.id === id && row.userId === userId) ?? notFound()

export function registerGoalHandlers(router: MockRouter) {
  router.on('GET', '/v1/goals', ({ db, userId, query }): GoalPage => {
    const today = todayIso()
    const goals = goalsOf(db.state, userId, today)
    return {
      ...paginate(goals, query, { defaultPageSize: 100, maxPageSize: 100 }),
      currency: baseCurrencyOf(db.state, userId),
      summary: summarizeGoals(db.state, userId, goals, today),
    }
  })

  router.on('POST', '/v1/goals', ({ db, userId, body }) => {
    const today = todayIso()
    const base = baseCurrencyOf(db.state, userId)
    const row: GoalRow = {
      id: newId('goal'),
      userId,
      saved: 0,
      currency: base,
      createdAt: new Date().toISOString(),
      ...validateGoal(db, userId, body, today),
    }
    db.state.goals.push(row)
    db.save()
    return goalView(db.state, row, base, today)
  })

  router.on('PUT', '/v1/goals/:id', ({ db, userId, params, body }) => {
    const row = ownGoal(db, userId, params.id)
    const today = todayIso()
    const base = baseCurrencyOf(db.state, userId)
    const fields = validateGoal(db, userId, body, today, row)
    rebaseGoal(db.state, row, base, today)
    Object.assign(row, fields)
    db.save()
    return goalView(db.state, row, base, today)
  })

  router.on('DELETE', '/v1/goals/:id', ({ db, userId, params }) => {
    const row = ownGoal(db, userId, params.id)
    db.state.goals = db.state.goals.filter((goal) => goal.id !== row.id)
    db.state.goalContributions = db.state.goalContributions.filter((contribution) => contribution.goalId !== row.id)
    db.save()
  })

  router.on('POST', '/v1/goals/:id/contributions', ({ db, userId, params, body }) => {
    const goal = ownGoal(db, userId, params.id)
    const today = todayIso()
    const contribution = recordContribution(db, userId, goal, body, today)
    rebaseGoal(db.state, goal, contribution.baseCurrency, today)
    goal.saved += contribution.baseAmount
    db.state.goalContributions.push(contribution)
    db.save()
    return goalView(db.state, goal, contribution.baseCurrency, today)
  })
}
