import {
  GROUP_CATEGORIES_MAX,
  GROUP_MEMBERS_MAX,
  GROUP_NAME_MAX,
  type GroupCategoryDto,
  type GroupMemberDto,
  locales,
} from '../../app/shared/api/contract'
import type { Currency } from '../../app/shared/money/currencies'
import type { GroupCategoryRow, GroupMemberRow, GroupRow, MockDb } from '../db'
import { badRequest, notFound } from '../errors'
import { groupSummaries, groupView, hasEntries, isStandardCategory, memberInUse, membersOf, ownGroup } from '../groups'
import { newId } from '../ids'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { starterSet } from '../seed/categories'
import { CONTROL } from '../tags'
import { collectErrors, type ErrorCollector, isMissing, objectBody } from '../validation'
import { checkCurrency } from './debts'

const nameKey = (name: string): string => name.trim().toLocaleLowerCase()

const standardNames = new Set(
  starterSet
    .filter((starter) => starter.kind === 'expense' && isStandardCategory(starter.key))
    .flatMap((starter) => locales.map((locale) => nameKey(starter.names[locale]))),
)

function checkGroupName(value: unknown, errors: ErrorCollector): void {
  if (isMissing(value)) errors.add('name', 'validation.required')
  else if (typeof value !== 'string' || CONTROL.test(value.trim())) errors.add('name', 'validation.invalidValue')
  else if (value.trim().length > GROUP_NAME_MAX) errors.add('name', 'validation.nameTooLong')
}

function membersError(value: unknown): string | undefined {
  if (isMissing(value)) return 'validation.required'
  if (!Array.isArray(value)) return 'validation.invalidValue'
  if (value.length === 0) return 'validation.required'
  const names: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '' || CONTROL.test(item.trim())) return 'validation.invalidValue'
    names.push(item.trim())
  }
  if (names.some((name) => name.length > GROUP_NAME_MAX)) return 'validation.nameTooLong'
  if (names.length > GROUP_MEMBERS_MAX) return 'validation.tooManyMembers'
  return new Set(names.map(nameKey)).size === names.length ? undefined : 'validation.memberNameTaken'
}

function validateName(body: unknown): string {
  const { name } = objectBody(body)
  const errors = collectErrors()
  checkGroupName(name, errors)
  errors.throwIfAny()
  return (name as string).trim()
}

function validateGroup(body: unknown): { name: string; currency: Currency } {
  const { name, currency } = objectBody(body)
  const errors = collectErrors()
  checkGroupName(name, errors)
  checkCurrency(currency, errors)
  errors.throwIfAny()
  return { name: (name as string).trim(), currency: currency as Currency }
}

function validateNewGroup(body: unknown): { name: string; currency: Currency; members: string[] } {
  const { name, currency, members } = objectBody(body)
  const errors = collectErrors()
  checkGroupName(name, errors)
  checkCurrency(currency, errors)
  const membersProblem = membersError(members)
  if (membersProblem !== undefined) errors.add('members', membersProblem)
  errors.throwIfAny()
  return {
    name: (name as string).trim(),
    currency: currency as Currency,
    members: (members as string[]).map((member) => member.trim()),
  }
}

const memberOf = (db: MockDb, group: GroupRow, memberId: string | undefined): GroupMemberRow =>
  db.state.groupMembers.find((row) => row.id === memberId && row.groupId === group.id) ?? notFound()

const nameTaken = (rows: readonly { name: string }[], name: string): boolean =>
  rows.some((row) => nameKey(row.name) === nameKey(name))

export function registerGroupHandlers(router: MockRouter) {
  router.on('GET', '/v1/groups', ({ db, userId, query }) =>
    paginate(groupSummaries(db.state, userId), query, { defaultPageSize: 100, maxPageSize: 100 }),
  )

  router.on('POST', '/v1/groups', ({ db, userId, body }) => {
    const { members, ...fields } = validateNewGroup(body)
    const group: GroupRow = { id: newId('grp'), userId, ...fields, createdAt: new Date().toISOString() }
    db.state.groups.push(group)
    db.state.groupMembers.push(
      ...members.map((name, position) => ({ id: newId('mbr'), groupId: group.id, name, position })),
    )
    db.save()
    return groupView(db.state, group)
  })

  router.on('GET', '/v1/groups/:id', ({ db, userId, params }) =>
    groupView(db.state, ownGroup(db.state, userId, params.id)),
  )

  router.on('PUT', '/v1/groups/:id', ({ db, userId, params, body }) => {
    const fields = validateGroup(body)
    const group = ownGroup(db.state, userId, params.id)
    if (fields.currency !== group.currency && hasEntries(db.state, group.id)) {
      badRequest({ currency: ['validation.groupCurrencyLocked'] })
    }
    Object.assign(group, fields)
    db.save()
    return groupView(db.state, group)
  })

  router.on('DELETE', '/v1/groups/:id', ({ db, userId, params }) => {
    const group = ownGroup(db.state, userId, params.id)
    const { state } = db
    const outside = <T extends { groupId: string }>(rows: T[]): T[] => rows.filter((row) => row.groupId !== group.id)
    state.groups = state.groups.filter((row) => row.id !== group.id)
    state.groupMembers = outside(state.groupMembers)
    state.groupCategories = outside(state.groupCategories)
    state.groupExpenses = outside(state.groupExpenses)
    state.groupRepayments = outside(state.groupRepayments)
    state.groupEvents = outside(state.groupEvents)
    db.save()
  })

  router.on('POST', '/v1/groups/:id/members', ({ db, userId, params, body }): GroupMemberDto => {
    const name = validateName(body)
    const group = ownGroup(db.state, userId, params.id)
    const members = membersOf(db.state, group.id)
    if (nameTaken(members, name)) badRequest({ name: ['validation.memberNameTaken'] })
    if (members.length >= GROUP_MEMBERS_MAX) badRequest({ name: ['validation.tooManyMembers'] })
    const position = members.reduce((last, member) => Math.max(last, member.position), -1) + 1
    const row: GroupMemberRow = { id: newId('mbr'), groupId: group.id, name, position }
    db.state.groupMembers.push(row)
    db.save()
    return { id: row.id, name: row.name, inUse: false }
  })

  router.on('PUT', '/v1/groups/:id/members/:memberId', ({ db, userId, params, body }): GroupMemberDto => {
    const name = validateName(body)
    const group = ownGroup(db.state, userId, params.id)
    const member = memberOf(db, group, params.memberId)
    const others = membersOf(db.state, group.id).filter((row) => row.id !== member.id)
    if (nameTaken(others, name)) badRequest({ name: ['validation.memberNameTaken'] })
    member.name = name
    db.save()
    return { id: member.id, name: member.name, inUse: memberInUse(db.state, member.id) }
  })

  router.on('DELETE', '/v1/groups/:id/members/:memberId', ({ db, userId, params }) => {
    const group = ownGroup(db.state, userId, params.id)
    const member = memberOf(db, group, params.memberId)
    if (memberInUse(db.state, member.id)) badRequest({ memberId: ['validation.memberInUse'] })
    db.state.groupMembers = db.state.groupMembers.filter((row) => row.id !== member.id)
    db.save()
  })

  router.on('POST', '/v1/groups/:id/categories', ({ db, userId, params, body }): GroupCategoryDto => {
    const name = validateName(body)
    const group = ownGroup(db.state, userId, params.id)
    const own = db.state.groupCategories.filter((row) => row.groupId === group.id)
    if (nameTaken(own, name) || standardNames.has(nameKey(name))) {
      badRequest({ name: ['validation.categoryNameTaken'] })
    }
    if (own.length >= GROUP_CATEGORIES_MAX) badRequest({ name: ['validation.tooManyCategories'] })
    const row: GroupCategoryRow = { id: newId('gcat'), groupId: group.id, name, createdAt: new Date().toISOString() }
    db.state.groupCategories.push(row)
    db.save()
    return { id: row.id, standard: false, name: row.name }
  })
}
