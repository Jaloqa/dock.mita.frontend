export type GroupTagOption = { name: string; create: boolean }

const OPTIONS_MAX = 10

const tagKey = (name: string): string => name.trim().toLowerCase()

export function addGroupTag(chosen: readonly string[], name: string): string[] {
  const trimmed = name.trim()
  const taken = chosen.some((tag) => tagKey(tag) === tagKey(trimmed))
  if (trimmed === '' || taken) return [...chosen]
  return [...chosen, trimmed]
}

export function usedGroupTags(expenses: readonly { tags: readonly string[] }[]): string[] {
  const seen = new Set<string>()
  return expenses
    .flatMap((expense) => expense.tags)
    .filter((tag) => {
      const key = tagKey(tag)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function groupTagOptions(text: string, used: readonly string[], chosen: readonly string[]): GroupTagOption[] {
  const typed = text.trim()
  if (typed === '') return []
  const key = tagKey(typed)
  const taken = new Set(chosen.map(tagKey))
  const matching = used
    .filter((name) => !taken.has(tagKey(name)) && tagKey(name).includes(key))
    .map((name) => ({ name, create: false }))
  if (taken.has(key)) return matching.slice(0, OPTIONS_MAX)
  const exact = matching.find((option) => tagKey(option.name) === key)
  const head = exact ?? { name: typed, create: true }
  return [head, ...matching.filter((option) => option !== head)].slice(0, OPTIONS_MAX)
}
