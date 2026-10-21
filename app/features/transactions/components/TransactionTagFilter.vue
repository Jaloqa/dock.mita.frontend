<script setup lang="ts">
import type { AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import { TAGS_PER_TRANSACTION_MAX, type TransactionTagDto } from '~/shared/api/contract'
import { tagAutoCompletePt } from '../utils/tagAutoComplete'
import { TAG_SUGGESTIONS_MAX } from '../utils/tags'

defineProps<{ id: string }>()
const model = defineModel<TransactionTagDto[]>({ required: true })
const { t } = useI18n()
const { matches, loading, search } = useTagSuggestions()

const options = computed<TransactionTagDto[]>((previous) => {
  if (loading.value) return previous ?? []
  if (model.value.length >= TAGS_PER_TRANSACTION_MAX) return []
  const chosen = new Set(model.value.map((tag) => tag.id))
  return matches.value
    .filter((tag) => !chosen.has(tag.id))
    .slice(0, TAG_SUGGESTIONS_MAX)
    .map(({ id, name }) => ({ id, name }))
})

function choose(items: TransactionTagDto[]) {
  const unique = new Map(items.map((tag) => [tag.id, tag]))
  model.value = [...unique.values()].slice(0, TAGS_PER_TRANSACTION_MAX)
}
</script>

<template>
  <AutoComplete
    :model-value="model"
    :input-id="id"
    :suggestions="options"
    option-label="name"
    multiple
    auto-option-focus
    :delay="0"
    :show-empty-message="false"
    :placeholder="model.length === 0 ? t('transactions.filters.allTags') : undefined"
    input-class="min-h-11"
    fluid
    :pt="tagAutoCompletePt()"
    @update:model-value="choose"
    @complete="(event: AutoCompleteCompleteEvent) => search(event.query)"
  >
    <template #chip="{ value, removeCallback }">
      <TransactionTagPill :name="value.name" @remove="removeCallback($event)" />
    </template>
  </AutoComplete>
</template>
