import {
  type CategoryColor,
  type CategoryDto,
  type CategoryKind,
  categoryColors,
  categoryKinds,
} from '../../app/shared/api/contract'
import { categoriesInUse, otherCategoryOf, ownCategories, reassignCategory } from '../categories'
import type { CategoryRow, MockDb } from '../db'
import { badRequest, notFound } from '../errors'
import { newId } from '../ids'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { collectErrors, isMissing, objectBody } from '../validation'

export const CATEGORY_NAME_MAX = 40

type CategoryFields = Pick<CategoryRow, 'name' | 'kind' | 'color'>

const isKind = (value: unknown): value is CategoryKind => categoryKinds.includes(value as CategoryKind)

const isColor = (value: unknown): value is CategoryColor => categoryColors.includes(value as CategoryColor)

const normalized = (name: string): string => name.trim().toLocaleLowerCase()

const systemOrder = (row: CategoryRow): number => (row.system === 'transfer' ? 2 : row.system === 'other' ? 1 : 0)

const ordered = (rows: readonly CategoryRow[]): CategoryRow[] =>
  rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        categoryKinds.indexOf(a.row.kind) - categoryKinds.indexOf(b.row.kind) ||
        systemOrder(a.row) - systemOrder(b.row) ||
        a.index - b.index,
    )
    .map(({ row }) => row)

const ownCategory = (db: MockDb, userId: string, id: string | undefined): CategoryRow =>
  ownCategories(db, userId).find((row) => row.id === id) ?? notFound()

const toDto = ({ userId: _userId, ...row }: CategoryRow, inUse: Set<string>): CategoryDto => ({
  ...row,
  inUse: inUse.has(row.id),
})

function validateCategory(
  own: readonly CategoryRow[],
  body: unknown,
  existing?: { row: CategoryRow; inUse: boolean },
): CategoryFields {
  const { name, kind, color } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(name)) errors.add('name', 'validation.required')
  else if (typeof name !== 'string') errors.add('name', 'validation.invalidValue')
  else if (name.trim().length > CATEGORY_NAME_MAX) errors.add('name', 'validation.nameTooLong')
  if (isMissing(kind)) errors.add('kind', 'validation.required')
  else if (!isKind(kind)) errors.add('kind', 'validation.invalidValue')
  else if (existing && kind !== existing.row.kind && (existing.row.system !== null || existing.inUse)) {
    errors.add('kind', 'validation.categoryKindLocked')
  }
  if (isMissing(color)) errors.add('color', 'validation.required')
  else if (!isColor(color)) errors.add('color', 'validation.invalidValue')
  if (typeof name === 'string' && isKind(kind)) {
    const taken = own.some(
      (row) => row.kind === kind && row.id !== existing?.row.id && normalized(row.name) === normalized(name),
    )
    if (taken) errors.add('name', 'validation.categoryNameTaken')
  }
  errors.throwIfAny()
  return { name: (name as string).trim(), kind: kind as CategoryKind, color: color as CategoryColor }
}

export function registerCategoryHandlers(router: MockRouter) {
  router.on('GET', '/v1/categories', ({ db, userId, query }) => {
    if (query.kind !== undefined && !isKind(query.kind)) badRequest({ kind: ['validation.invalidValue'] })
    const inUse = categoriesInUse(db.state, userId)
    const rows = ordered(ownCategories(db, userId)).filter((row) => query.kind === undefined || row.kind === query.kind)
    return paginate(
      rows.map((row) => toDto(row, inUse)),
      query,
      { defaultPageSize: 100, maxPageSize: 100 },
    )
  })

  router.on('POST', '/v1/categories', ({ db, userId, body }) => {
    const row: CategoryRow = {
      id: newId('cat'),
      userId,
      system: null,
      ...validateCategory(ownCategories(db, userId), body),
    }
    db.state.categories.push(row)
    db.save()
    return toDto(row, categoriesInUse(db.state, userId))
  })

  router.on('PUT', '/v1/categories/:id', ({ db, userId, params, body }) => {
    const row = ownCategory(db, userId, params.id)
    const inUse = categoriesInUse(db.state, userId)
    Object.assign(row, validateCategory(ownCategories(db, userId), body, { row, inUse: inUse.has(row.id) }))
    db.save()
    return toDto(row, inUse)
  })

  router.on('DELETE', '/v1/categories/:id', ({ db, userId, params }) => {
    const row = ownCategory(db, userId, params.id)
    if (row.system !== null) badRequest({ id: ['validation.systemCategory'] })
    if (categoriesInUse(db.state, userId).has(row.id)) {
      const other = otherCategoryOf(db.state, userId, row.kind) ?? notFound()
      reassignCategory(db.state, userId, row.id, other.id)
    }
    db.state.categories = db.state.categories.filter((category) => category.id !== row.id)
    db.save()
  })
}
