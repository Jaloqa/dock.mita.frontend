<script setup lang="ts">
import type { ToConfirmLineDto } from '~/shared/api/contract'
import type { ConfirmLineForm } from '../schemas/confirmSchema'

type LineErrors = { categoryId: string[]; title: string[]; tags: string[] }

const props = defineProps<{
  line: ToConfirmLineDto
  index: number
  legend: string
  categories: { value: string; label: string }[]
  tagSuggestions: string[]
  errors: LineErrors
  loading?: boolean
}>()
const model = defineModel<ConfirmLineForm>({ required: true })
const emit = defineEmits<{ touch: [field: keyof LineErrors] }>()
const { t } = useI18n()
const { format } = useMoney()

const tagField = ref<{ flush: () => void } | null>(null)

const id = (field: string) => `confirm-line-${props.index}-${field}`
const amountText = computed(() => format(props.line.amount, props.line.currency))

defineExpose({ flush: () => tagField.value?.flush() })
</script>

<template>
  <fieldset class="m-0 flex min-w-0 flex-col gap-3 rounded-xl border border-border p-3">
    <legend class="px-1 text-[13px] font-medium break-words">
      {{ t('groups.toConfirm.line.legend', { title: legend, amount: amountText }) }}
    </legend>
    <FormRow :id="id('category')" :label="t('groups.toConfirm.line.category')" :errors="errors.categoryId">
      <template #default="{ invalid, describedBy, labelId }">
        <Select
          v-model="model.categoryId"
          :input-id="id('category')"
          :options="categories"
          option-label="label"
          option-value="value"
          :placeholder="t('groups.toConfirm.line.categoryPlaceholder')"
          :loading="loading"
          :invalid="invalid"
          :aria-labelledby="labelId"
          :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
          class="min-h-11"
          fluid
          @change="emit('touch', 'categoryId')"
        />
      </template>
    </FormRow>
    <FormRow :id="id('title')" :label="t('groups.toConfirm.line.title')" :errors="errors.title">
      <template #default="{ invalid, describedBy }">
        <InputText
          :id="id('title')"
          v-model="model.title"
          autocomplete="off"
          class="min-h-11"
          :invalid="invalid"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
          fluid
          @input="emit('touch', 'title')"
        />
      </template>
    </FormRow>
    <FormRow :id="id('tags')" :label="t('groups.toConfirm.line.tags')" :errors="errors.tags">
      <template #default="{ invalid, describedBy }">
        <GroupTagField
          :id="id('tags')"
          ref="tagField"
          v-model="model.tags"
          :suggestions="tagSuggestions"
          :invalid="invalid"
          :described-by="describedBy"
          @update:model-value="emit('touch', 'tags')"
        />
      </template>
    </FormRow>
  </fieldset>
</template>
