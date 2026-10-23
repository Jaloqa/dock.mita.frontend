<script setup lang="ts">
import type { AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import { addGroupTag, type GroupTagOption, groupTagOptions } from '../utils/groupTags'

const props = defineProps<{ id: string; suggestions: string[]; invalid?: boolean; describedBy?: string }>()
const model = defineModel<string[]>({ required: true })
const { t } = useI18n()
const field = ref<{ $el: HTMLElement; hide: (isFocus?: boolean) => void } | null>(null)
const options = ref<GroupTagOption[]>([])
const listVisible = ref(false)
let searched = ''

const selected = computed<GroupTagOption[]>({
  get: () => model.value.map((name) => ({ name, create: false })),
  set: (items) => {
    model.value = items.reduce<string[]>((chosen, item) => addGroupTag(chosen, item.name), [])
  },
})

const pt = computed(() => ({
  inputMultiple: { role: 'list', 'aria-orientation': undefined, 'aria-activedescendant': undefined },
  chipItem: {
    role: 'listitem',
    'aria-label': undefined,
    'aria-selected': undefined,
    'aria-setsize': undefined,
    'aria-posinset': undefined,
  },
  inputChip: { role: 'presentation' },
  input: { 'aria-describedby': props.describedBy },
}))

function search(event: AutoCompleteCompleteEvent) {
  searched = event.query
  options.value = groupTagOptions(event.query, props.suggestions, model.value)
}

function commit(input: HTMLInputElement) {
  model.value = addGroupTag(model.value, input.value)
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
  if (input.value.trim() === '' || (listVisible.value && input.value === searched)) return
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
    :placeholder="model.length === 0 ? t('groups.expense.tagsPlaceholder') : undefined"
    input-class="min-h-11"
    fluid
    :pt="pt"
    @complete="search"
    @show="listVisible = true"
    @hide="listVisible = false"
    @keydown.capture="onKeydownCapture"
  >
    <template #chip="{ value, removeCallback }">
      <span class="inline-flex items-center gap-1 rounded-full bg-track py-0.5 ps-3 pe-1 text-sm font-medium text-ink">
        {{ value.name }}
        <button
          type="button"
          class="relative inline-flex size-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          :aria-label="t('groups.expense.removeTag', { name: value.name })"
          @click="removeCallback($event)"
        >
          <AppIcon name="close" :size="12" :stroke-width="2.4" />
        </button>
      </span>
    </template>
    <template #option="{ option }">
      {{ option.create ? t('groups.expense.createTag', { name: option.name }) : option.name }}
    </template>
  </AutoComplete>
</template>
