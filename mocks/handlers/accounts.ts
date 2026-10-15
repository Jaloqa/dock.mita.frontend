import { type AccountDto, type AccountType, accountTypes } from '../../app/shared/api/contract'
import type { Currency } from '../../app/shared/money/money'
import type { AccountRow, MockDb } from '../db'
import { badRequest, notFound } from '../errors'
import { newId } from '../ids'
import { accountBalances, accountsInUse } from '../ledger'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { collectErrors, isCurrency, isMissing, objectBody } from '../validation'

export const ACCOUNT_NAME_MAX = 40
const MAX_AMOUNT = 100_000_000_000

type AccountFields = Pick<AccountRow, 'name' | 'type' | 'currency' | 'openingBalance' | 'cardLast4' | 'archived'>
type Usage = { balances: Map<string, number>; inUse: Set<string> }

const isAccountType = (value: unknown): value is AccountType => accountTypes.includes(value as AccountType)

function validateAccount(body: unknown, existing?: { row: AccountRow; inUse: boolean }): AccountFields {
  const input = objectBody(body)
  const { name, type, currency, openingBalance, cardLast4, archived } = input
  const errors = collectErrors()
  if (isMissing(name)) errors.add('name', 'validation.required')
  else if (typeof name !== 'string') errors.add('name', 'validation.invalidValue')
  else if (name.trim().length > ACCOUNT_NAME_MAX) errors.add('name', 'validation.nameTooLong')
  if (isMissing(type)) errors.add('type', 'validation.required')
  else if (!isAccountType(type)) errors.add('type', 'validation.invalidValue')
  if (isMissing(currency)) errors.add('currency', 'validation.required')
  else if (!isCurrency(currency)) errors.add('currency', 'validation.invalidValue')
  else if (existing?.inUse && currency !== existing.row.currency) errors.add('currency', 'validation.currencyLocked')
  if (isMissing(openingBalance)) errors.add('openingBalance', 'validation.required')
  else if (!Number.isSafeInteger(openingBalance) || Math.abs(openingBalance as number) > MAX_AMOUNT) {
    errors.add('openingBalance', 'validation.invalidValue')
  }
  if (!isMissing(cardLast4) && (typeof cardLast4 !== 'string' || !/^\d{4}$/.test(cardLast4))) {
    errors.add('cardLast4', 'validation.cardLast4')
  }
  if (archived !== undefined && typeof archived !== 'boolean') errors.add('archived', 'validation.invalidValue')
  errors.throwIfAny()
  return {
    name: (name as string).trim(),
    type: type as AccountType,
    currency: currency as Currency,
    openingBalance: openingBalance as number,
    cardLast4: type === 'card' && !isMissing(cardLast4) ? (cardLast4 as string) : null,
    archived: typeof archived === 'boolean' ? archived : (existing?.row.archived ?? false),
  }
}

const usageOf = (db: MockDb, userId: string): Usage => ({
  balances: accountBalances(db.state, userId),
  inUse: accountsInUse(db.state, userId),
})

const toDto = ({ userId: _userId, createdAt: _createdAt, ...row }: AccountRow, usage: Usage): AccountDto => ({
  ...row,
  balance: usage.balances.get(row.id) ?? row.openingBalance,
  inUse: usage.inUse.has(row.id),
})

const ownAccount = (db: MockDb, userId: string, id: string | undefined): AccountRow =>
  db.state.accounts.find((account) => account.id === id && account.userId === userId) ?? notFound()

export function registerAccountHandlers(router: MockRouter) {
  router.on('GET', '/v1/accounts', ({ db, userId, query }) => {
    const usage = usageOf(db, userId)
    const own = db.state.accounts.filter((account) => account.userId === userId)
    return paginate(
      own.map((row) => toDto(row, usage)),
      query,
      { defaultPageSize: 100, maxPageSize: 100 },
    )
  })

  router.on('POST', '/v1/accounts', ({ db, userId, body }) => {
    const row: AccountRow = { id: newId('acc'), userId, createdAt: new Date().toISOString(), ...validateAccount(body) }
    db.state.accounts.push(row)
    db.save()
    return toDto(row, usageOf(db, userId))
  })

  router.on('PUT', '/v1/accounts/:id', ({ db, userId, params, body }) => {
    const row = ownAccount(db, userId, params.id)
    const usage = usageOf(db, userId)
    Object.assign(row, validateAccount(body, { row, inUse: usage.inUse.has(row.id) }))
    db.save()
    return toDto(row, usageOf(db, userId))
  })

  router.on('DELETE', '/v1/accounts/:id', ({ db, userId, params }) => {
    const row = ownAccount(db, userId, params.id)
    if (accountsInUse(db.state, userId).has(row.id)) badRequest({ id: ['validation.accountInUse'] })
    db.state.accounts = db.state.accounts.filter((account) => account.id !== row.id)
    db.save()
  })
}
