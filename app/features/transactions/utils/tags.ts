export type TagOption = { name: string; create: boolean }

export const TAG_SUGGESTIONS_MAX = 10
export const TAG_SUGGESTIONS_FETCH = 100

export const normalizeTag = (name: string): string => name.trim().toLowerCase()

export function addTag(chosen: readonly string[], name: string): string[] {
  const trimmed = name.trim()
  if (trimmed === '' || chosen.some((tag) => normalizeTag(tag) === normalizeTag(trimmed))) return [...chosen]
  return [...chosen, trimmed]
}

export function tagSuggestions(text: string, existing: readonly string[], chosen: readonly string[]): TagOption[] {
  const typed = text.trim()
  if (typed === '') return []
  const key = normalizeTag(typed)
  const taken = new Set(chosen.map(normalizeTag))
  if (taken.has(key)) return suggestionsOf(existing, key, taken)
  const exact = existing.find((name) => normalizeTag(name) === key)
  const head: TagOption = exact === undefined ? { name: typed, create: true } : { name: exact, create: false }
  const rest = suggestionsOf(existing, key, taken).filter((option) => option.name !== head.name)
  return [head, ...rest].slice(0, TAG_SUGGESTIONS_MAX)
}

function suggestionsOf(existing: readonly string[], key: string, taken: ReadonlySet<string>): TagOption[] {
  return existing
    .filter((name) => !taken.has(normalizeTag(name)) && normalizeTag(name).includes(key))
    .slice(0, TAG_SUGGESTIONS_MAX)
    .map((name) => ({ name, create: false }))
}

export function visibleTags(names: readonly string[], limit: number): { shown: string[]; hidden: number } {
  return { shown: names.slice(0, limit), hidden: Math.max(0, names.length - limit) }
}
