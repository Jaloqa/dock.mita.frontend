import { TAG_NAME_MAX, TAGS_PER_TRANSACTION_MAX, type TransactionTagDto } from '../app/shared/api/contract'
import type { MockState, TagRow } from './db'
import { newId } from './ids'

export const CONTROL = /\p{Cc}/u

export const key = (name: string): string => name.toLocaleLowerCase()

function distinct(names: readonly string[]): string[] {
  const seen = new Set<string>()
  return names.filter((name) => {
    const id = key(name)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function tagsError(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) return 'validation.invalidValue'
  const names: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return 'validation.invalidValue'
    const trimmed = item.trim()
    if (trimmed === '' || CONTROL.test(trimmed)) return 'validation.invalidValue'
    names.push(trimmed)
  }
  if (names.some((name) => name.length > TAG_NAME_MAX)) return 'validation.tagTooLong'
  return distinct(names).length > TAGS_PER_TRANSACTION_MAX ? 'validation.tooManyTags' : undefined
}

export const parseTags = (value: unknown): string[] =>
  Array.isArray(value) ? distinct(value.map((item) => String(item).trim())) : []

export function upsertTags(state: MockState, userId: string, names: readonly string[]): string[] {
  return names.map((name) => {
    const existing = state.tags.find((tag) => tag.userId === userId && key(tag.name) === key(name))
    if (existing) return existing.id
    const created: TagRow = { id: newId('tag'), userId, name }
    state.tags.push(created)
    return created.id
  })
}

export function tagRefs(state: MockState, ids: readonly string[]): TransactionTagDto[] {
  const byId = new Map(state.tags.map((tag) => [tag.id, tag.name]))
  return ids
    .flatMap((id) => {
      const name = byId.get(id)
      return name === undefined ? [] : [{ id, name }]
    })
    .sort((a, b) => key(a.name).localeCompare(key(b.name)) || a.id.localeCompare(b.id))
}

export function tagUsage(state: MockState, userId: string): Map<string, number> {
  const usage = new Map<string, number>()
  for (const row of state.transactions) {
    if (row.userId !== userId) continue
    for (const id of row.tagIds) usage.set(id, (usage.get(id) ?? 0) + 1)
  }
  return usage
}
