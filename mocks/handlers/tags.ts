import { TAG_NAME_MAX, type TagDto } from '../../app/shared/api/contract'
import type { MockDb, TagRow } from '../db'
import { notFound } from '../errors'
import { paginate } from '../paginate'
import type { MockRouter } from '../router'
import { CONTROL, key, tagUsage } from '../tags'
import { collectErrors, isMissing, objectBody } from '../validation'

const ownTags = (db: MockDb, userId: string): TagRow[] => db.state.tags.filter((tag) => tag.userId === userId)

const byName = (a: TagRow, b: TagRow): number => key(a.name).localeCompare(key(b.name)) || a.id.localeCompare(b.id)

const toDto = ({ id, name }: TagRow, usage: Map<string, number>): TagDto => ({ id, name, usage: usage.get(id) ?? 0 })

function validateName(own: readonly TagRow[], id: string | undefined, body: unknown): string {
  const { name } = objectBody(body)
  const errors = collectErrors()
  if (isMissing(name)) errors.add('name', 'validation.required')
  else if (typeof name !== 'string' || CONTROL.test(name.trim())) errors.add('name', 'validation.invalidValue')
  else if (name.trim().length > TAG_NAME_MAX) errors.add('name', 'validation.tagTooLong')
  else if (own.some((tag) => tag.id !== id && key(tag.name) === key(name.trim()))) {
    errors.add('name', 'validation.tagNameTaken')
  }
  errors.throwIfAny()
  return (name as string).trim()
}

export function registerTagHandlers(router: MockRouter) {
  router.on('GET', '/v1/tags', ({ db, userId, query }) => {
    const search = query.search?.trim().toLocaleLowerCase() ?? ''
    const usage = tagUsage(db.state, userId)
    const rows = ownTags(db, userId)
      .filter((tag) => search === '' || key(tag.name).includes(search))
      .sort(byName)
    return paginate(
      rows.map((tag) => toDto(tag, usage)),
      query,
      { defaultPageSize: 100, maxPageSize: 100 },
    )
  })

  router.on('PUT', '/v1/tags/:id', ({ db, userId, params, body }) => {
    const own = ownTags(db, userId)
    const name = validateName(own, params.id, body)
    const row = own.find((tag) => tag.id === params.id) ?? notFound()
    row.name = name
    db.save()
    return toDto(row, tagUsage(db.state, userId))
  })

  router.on('DELETE', '/v1/tags/:id', ({ db, userId, params }) => {
    const row = ownTags(db, userId).find((tag) => tag.id === params.id) ?? notFound()
    db.state.tags = db.state.tags.filter((tag) => tag.id !== row.id)
    for (const transaction of db.state.transactions) {
      if (transaction.userId === userId) transaction.tagIds = transaction.tagIds.filter((id) => id !== row.id)
    }
    db.save()
  })
}
