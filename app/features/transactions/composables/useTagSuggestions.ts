import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { TagDto } from '~/shared/api/contract'
import { tagKeys } from '../api/keys'
import { tagsApi } from '../api/tagsApi'
import { TAG_SUGGESTIONS_FETCH, type TagOption, tagSuggestions } from '../utils/tags'

const SEARCH_DELAY_MS = 200

export function useTagSuggestions(chosen: MaybeRefOrGetter<readonly string[]> = []) {
  const api = tagsApi(useApi())
  const searched = shallowRef({ text: '' })
  const pending = ref(false)
  const text = computed(() => searched.value.text)
  let timer: ReturnType<typeof setTimeout> | undefined

  const query = useQuery({
    queryKey: computed(() => tagKeys.suggestions(text.value)),
    queryFn: () => api.list({ search: text.value, page: 1, pageSize: TAG_SUGGESTIONS_FETCH }),
    enabled: computed(() => text.value !== ''),
    staleTime: 0,
    placeholderData: keepPreviousData,
  })

  const matches = computed<TagDto[]>(() => (text.value === '' ? [] : (query.data.value?.items ?? [])))
  const options = computed<TagOption[]>((previous) =>
    pending.value
      ? (previous ?? [])
      : tagSuggestions(
          searched.value.text,
          matches.value.map((tag) => tag.name),
          toValue(chosen),
        ),
  )

  function search(value: string) {
    clearTimeout(timer)
    pending.value = true
    timer = setTimeout(() => {
      searched.value = { text: value.trim() }
      pending.value = false
    }, SEARCH_DELAY_MS)
  }

  onScopeDispose(() => clearTimeout(timer))

  return { options, matches, pending: readonly(pending), search }
}
