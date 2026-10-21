<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { TagDto, TagInput } from '~/shared/api/contract'
import { type TagForm, tagRules } from '../schemas/tagSchema'

const props = defineProps<{ tag: TagDto; takenNames: string[] }>()
const emit = defineEmits<{ remove: [tag: TagDto]; missing: [] }>()
const { t } = useI18n()
const notify = useNotify()
const server = useServerErrors()
const { rename, isMissing } = useTagMutations()

const editing = ref(false)
const nameId = computed(() => `tag-name-${props.tag.id}`)
const form = reactive<TagForm>({ name: props.tag.name })
const v$ = useVuelidate(
  tagRules(t, () => props.takenNames),
  form,
)
const formEl = ref<HTMLFormElement | null>(null)
const renameButton = ref<HTMLButtonElement | null>(null)
const iconButton =
  'flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-muted transition-colors hover:text-ink focus-visible:text-ink'

const errors = computed(() => [
  ...v$.value.name.$errors.map((error) => String(unref(error.$message))),
  ...server.messages('name'),
])

async function startEditing() {
  form.name = props.tag.name
  server.clear()
  v$.value.$reset()
  editing.value = true
  await nextTick()
  formEl.value?.querySelector<HTMLInputElement>(`#${nameId.value}`)?.focus()
}

async function stopEditing() {
  editing.value = false
  await nextTick()
  renameButton.value?.focus()
}

function touch() {
  v$.value.name.$touch()
  server.clear('name')
}

async function showServerErrors(error: unknown) {
  if (server.apply(error, ['name'])) {
    await nextTick()
    focusFirstInvalid(formEl.value)
    return
  }
  notify.error(error)
  if (isMissing(error)) {
    editing.value = false
    emit('missing')
  }
}

async function submit() {
  server.clear()
  if (!(await v$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(formEl.value)
    return
  }
  const input: TagInput = { name: form.name.trim() }
  rename.mutate(
    { id: props.tag.id, input },
    {
      onSuccess: () => {
        notify.success(t('transactions.tagManager.toast.renamed'))
        stopEditing()
      },
      onError: showServerErrors,
    },
  )
}
</script>

<template>
  <li class="flex min-h-12 items-center gap-3 border-b border-border py-1 last:border-b-0">
    <form
      v-if="editing"
      ref="formEl"
      :aria-label="t('transactions.tagManager.rename', { name: tag.name })"
      class="flex w-full flex-col gap-3 rounded-(--radius-control) border border-border bg-bg p-3"
      novalidate
      @submit.prevent="submit"
      @keydown.esc.stop.prevent="stopEditing"
    >
      <FormRow :id="nameId" :label="t('transactions.tagManager.name')" :errors="errors">
        <template #default="{ invalid, describedBy }">
          <InputText
            :id="nameId"
            v-model="form.name"
            autocomplete="off"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch"
          />
        </template>
      </FormRow>
      <div class="flex justify-end gap-2">
        <Button
          :label="t('shared.actions.cancel')"
          severity="secondary"
          outlined
          class="min-h-11"
          @click="stopEditing"
        />
        <Button
          type="submit"
          :label="t('shared.actions.save')"
          class="min-h-11"
          :loading="rename.isPending.value"
          :disabled="rename.isPending.value"
        />
      </div>
    </form>
    <template v-else>
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-medium">{{ tag.name }}</span>
        <span class="text-xs text-muted">{{
          t('transactions.tagManager.usage', { count: tag.usage }, tag.usage)
        }}</span>
      </div>
      <div class="-mr-2 flex shrink-0">
        <button
          ref="renameButton"
          type="button"
          :class="iconButton"
          :data-tag-rename="tag.id"
          :aria-label="t('transactions.tagManager.rename', { name: tag.name })"
          @click="startEditing"
        >
          <AppIcon name="edit" />
        </button>
        <button
          type="button"
          :class="iconButton"
          :aria-label="t('transactions.tagManager.delete', { name: tag.name })"
          @click="emit('remove', tag)"
        >
          <AppIcon name="trash" />
        </button>
      </div>
    </template>
  </li>
</template>
