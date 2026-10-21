<script setup lang="ts">
import type { AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import { tagAutoCompletePt } from '../utils/tagAutoComplete'
import { addTag, type TagOption } from '../utils/tags'

const props = defineProps<{ id: string; invalid?: boolean; describedBy?: string }>()
const model = defineModel<string[]>({ required: true })
const { t } = useI18n()
const { options, pending, search } = useTagSuggestions(model)
const field = ref<{ $el: HTMLElement; hide: (isFocus?: boolean) => void } | null>(null)
const listVisible = ref(false)

const selected = computed<TagOption[]>({
  get: () => model.value.map((name) => ({ name, create: false })),
  set: (items) => {
    model.value = items.reduce<string[]>((chosen, item) => addTag(chosen, item.name), [])
  },
})

function commit(input: HTMLInputElement) {
  model.value = addTag(model.value, input.value)
  input.value = ''
  field.value?.hide()
}

function flush() {
  const input = field.value?.$el.querySelector('input')
  if (input && input.value.trim() !== '') commit(input)
}

function onKeydownCapture(event: KeyboardEvent) {
  const input = event.target
  if (event.key !== 'Enter' || event.isComposing || !(input instanceof HTMLInputElement)) return
  if (input.value.trim() === '' || (listVisible.value && !pending.value)) return
  event.preventDefault()
  event.stopPropagation()
  commit(input)
}

defineExpose({ flush })
</script>

<template>
  <AutoComplete
    ref="field"
    v-model="selected"
    :input-id="id"
    :suggestions="options"
    option-label="name"
    multiple
    auto-option-focus
    :delay="0"
    :show-empty-message="false"
    :invalid="invalid"
    :placeholder="model.length === 0 ? t('transactions.tags.placeholder') : undefined"
    input-class="min-h-11"
    fluid
    :pt="tagAutoCompletePt(props.describedBy)"
    @complete="(event: AutoCompleteCompleteEvent) => search(event.query)"
    @show="listVisible = true"
    @hide="listVisible = false"
    @keydown.capture="onKeydownCapture"
  >
    <template #chip="{ value, removeCallback }">
      <TransactionTagPill :name="value.name" @remove="removeCallback($event)" />
    </template>
    <template #option="{ option }">
      {{ option.create ? t('transactions.tags.create', { name: option.name }) : option.name }}
    </template>
  </AutoComplete>
</template>
