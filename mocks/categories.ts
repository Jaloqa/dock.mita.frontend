import { type CategoryKind, type Locale, locales } from '../app/shared/api/contract'
import type { CategoryRow, MockDb, MockState } from './db'
import { newId } from './ids'
import { starterCategories } from './seed/categories'

export type CategoryReference = {
  usedCategoryIds(state: MockState, userId: string): Set<string>
  reassign(state: MockState, userId: string, fromId: string, toId: string): void
}

export const categoryReferences: CategoryReference[] = []

export function categoriesInUse(state: MockState, userId: string): Set<string> {
  return new Set(categoryReferences.flatMap((reference) => [...reference.usedCategoryIds(state, userId)]))
}

export function reassignCategory(state: MockState, userId: string, fromId: string, toId: string): void {
  for (const reference of categoryReferences) reference.reassign(state, userId, fromId, toId)
}

const starterLocale = (state: MockState, userId: string): Locale => {
  const locale = state.settings.find((row) => row.userId === userId)?.locale
  return locale !== undefined && locales.includes(locale) ? locale : 'en'
}

export function ensureCategories(state: MockState, userId: string): boolean {
  if (state.categories.some((row) => row.userId === userId)) return false
  state.categories.push(...starterCategories(userId, starterLocale(state, userId), () => newId('cat')))
  return true
}

export function ownCategories(db: MockDb, userId: string): CategoryRow[] {
  if (ensureCategories(db.state, userId)) db.save()
  return db.state.categories.filter((row) => row.userId === userId)
}

export const otherCategoryOf = (state: MockState, userId: string, kind: CategoryKind): CategoryRow | undefined =>
  state.categories.find((row) => row.userId === userId && row.kind === kind && row.system === 'other')
