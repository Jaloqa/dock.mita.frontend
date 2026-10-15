import { type CategoryDto, type CategoryKind, categoryKinds } from '../../app/shared/api/contract'
import { categoriesInUse, ensureCategories } from '../categories'
import type { CategoryRow, MockDb } from '../db'
import { badRequest } from '../errors'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'

const isKind = (value: unknown): value is CategoryKind => categoryKinds.includes(value as CategoryKind)

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

const ownRows = (db: MockDb, userId: string): CategoryRow[] => {
  if (ensureCategories(db.state, userId)) db.save()
  return db.state.categories.filter((row) => row.userId === userId)
}

const toDto = ({ userId: _userId, ...row }: CategoryRow, inUse: Set<string>): CategoryDto => ({
  ...row,
  inUse: inUse.has(row.id),
})

export function registerCategoryHandlers(router: MockRouter) {
  router.on('GET', '/v1/categories', ({ db, userId, query }) => {
    if (query.kind !== undefined && !isKind(query.kind)) badRequest({ kind: ['validation.invalidValue'] })
    const inUse = categoriesInUse(db.state, userId)
    const rows = ordered(ownRows(db, userId)).filter((row) => query.kind === undefined || row.kind === query.kind)
    return paginate(
      rows.map((row) => toDto(row, inUse)),
      query,
      { defaultPageSize: 100, maxPageSize: 100 },
    )
  })
}
