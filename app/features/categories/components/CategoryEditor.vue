<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { CategoryColor, CategoryDto, CategoryInput, CategoryKind } from '~/shared/api/contract'
import { type CategoryForm, categoryRules } from '../schemas/categorySchema'

const props = defineProps<{
  kind: CategoryKind
  category?: CategoryDto
  takenNames: string[]
  defaultColor: CategoryColor
}>()
const emit = defineEmits<{ done: []; cancel: [] }>()
const { t } = useI18n()
const notify = useNotify()
const server = useServerErrors()
const { create, update } = useCategoryMutations()

const fields = ['name', 'color'] as const
type Field = (typeof fields)[number]

const form = reactive<CategoryForm>({
  name: props.category?.name ?? '',
  color: props.category?.color ?? props.defaultColor,
})
const v$ = useVuelidate(
  categoryRules(t, () => props.takenNames),
  form,
)
const formEl = ref<HTMLFormElement | null>(null)
const saving = computed(() => create.isPending.value || update.isPending.value)
const title = computed(() => (props.category ? t('categories.form.editTitle') : t('categories.form.createTitle')))

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

function touch(field: Field) {
  v$.value[field].$touch()
  server.clear(field)
}

async function showServerErrors(error: unknown) {
  if (server.apply(error, fields)) {
    await nextTick()
    focusFirstInvalid(formEl.value)
  } else notify.error(error)
}

const finish = (message: string) => {
  notify.success(message)
  emit('done')
}

async function submit() {
  server.clear()
  if (!(await v$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(formEl.value)
    return
  }
  const input: CategoryInput = { name: form.name.trim(), kind: props.category?.kind ?? props.kind, color: form.color }
  const category = props.category
  if (category) {
    update.mutate(
      { id: category.id, input },
      { onSuccess: () => finish(t('categories.toast.updated')), onError: showServerErrors },
    )
  } else {
    create.mutate(input, { onSuccess: () => finish(t('categories.toast.created')), onError: showServerErrors })
  }
}

onMounted(() => formEl.value?.querySelector<HTMLInputElement>('#category-name')?.focus())
</script>

<template>
  <form
    ref="formEl"
    :aria-label="title"
    class="flex w-full flex-col gap-3 rounded-(--radius-control) border border-border bg-bg p-3"
    novalidate
    @submit.prevent="submit"
    @keydown.esc.stop.prevent="emit('cancel')"
  >
    <FormRow id="category-name" :label="t('categories.form.name')" :errors="errorsOf('name')">
      <template #default="{ invalid, describedBy }">
        <InputText
          id="category-name"
          v-model="form.name"
          autocomplete="off"
          :invalid="invalid"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
          fluid
          @blur="touch('name')"
        />
      </template>
    </FormRow>
    <FormRow id="category-color" :label="t('categories.form.color')" :errors="errorsOf('color')">
      <template #default="{ labelId }">
        <CategoryColorPicker v-model="form.color" :labelled-by="labelId" />
      </template>
    </FormRow>
    <div class="flex justify-end gap-2">
      <Button
        :label="t('shared.actions.cancel')"
        severity="secondary"
        outlined
        class="min-h-11"
        @click="emit('cancel')"
      />
      <Button type="submit" :label="t('shared.actions.save')" class="min-h-11" :loading="saving" :disabled="saving" />
    </div>
  </form>
</template>
