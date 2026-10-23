<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { GroupCategoryDto, GroupDto } from '~/shared/api/contract'
import { type GroupCategoryForm, groupCategoryRules } from '../schemas/groupCategorySchema'
import { categoryLabel } from '../utils/groupView'
import { unlessMemberRefusal } from '../utils/scope'

const props = defineProps<{ group: GroupDto; id: string; invalid?: boolean; labelId?: string; describedBy?: string }>()
const model = defineModel<string>({ required: true })
const { t } = useI18n()
const notify = useNotify()
const server = useServerErrors()
const { addCategory } = useGroupMutations()
const scope = useGroupScope()

const root = ref<HTMLElement | null>(null)
const adding = ref(false)
const added = ref<GroupCategoryDto[]>([])
const form = reactive<GroupCategoryForm>({ name: '' })

const nameId = computed(() => `${props.id}-new`)
const panelId = computed(() => `${props.id}-new-panel`)
const errorId = computed(() => `${props.id}-new-error`)
const categories = computed(() => [
  ...props.group.categories,
  ...added.value.filter((category) => !props.group.categories.some((known) => known.id === category.id)),
])
const options = computed(() =>
  categories.value.map((category) => ({
    value: category.id,
    label: categoryLabel(t, { categories: categories.value }, category.id),
  })),
)

const v$ = useVuelidate(
  groupCategoryRules(t, () => options.value.map((option) => option.label)),
  form,
  { $stopPropagation: true },
)

const errors = computed(() => [
  ...v$.value.name.$errors.map((error) => String(unref(error.$message))),
  ...server.messages('name'),
])
const nameInvalid = computed(() => errors.value.length > 0)

const find = <T extends HTMLElement>(selector: string) => root.value?.querySelector<T>(selector)

function resetName() {
  form.name = ''
  server.clear()
  v$.value.$reset()
}

async function focusName() {
  await nextTick()
  find<HTMLInputElement>('[data-new-category]')?.focus()
}

async function toggle() {
  adding.value = !adding.value
  resetName()
  if (adding.value) await focusName()
}

async function cancel() {
  adding.value = false
  resetName()
  await nextTick()
  find('[data-new-category-toggle]')?.focus()
}

function onInput() {
  server.clear('name')
}

async function add() {
  if (addCategory.isPending.value) return
  server.clear()
  if (!(await v$.value.$validate())) {
    await focusName()
    return
  }
  addCategory.mutate(
    { scope: scope.value, input: { name: form.name.trim() } },
    {
      onSuccess: async (category) => {
        added.value = [...added.value, category]
        model.value = category.id
        adding.value = false
        resetName()
        await nextTick()
        find('[role="combobox"]')?.focus()
      },
      onError: unlessMemberRefusal(async (error) => {
        if (!server.apply(error, ['name'])) {
          notify.error(error)
          return
        }
        await focusName()
      }),
    },
  )
}
</script>

<template>
  <div ref="root" class="flex flex-col gap-2">
    <div class="flex flex-wrap items-start gap-2">
      <Select
        v-model="model"
        :input-id="id"
        :options="options"
        option-label="label"
        option-value="value"
        :invalid="invalid"
        :aria-labelledby="labelId"
        :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
        class="min-h-11 min-w-48 flex-1"
      />
      <Button
        type="button"
        severity="secondary"
        outlined
        class="min-h-11 shrink-0"
        data-new-category-toggle
        :aria-expanded="adding"
        :aria-controls="adding ? panelId : undefined"
        @click="toggle"
      >
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('groups.expense.newCategory') }}
      </Button>
    </div>
    <div v-if="adding" :id="panelId" class="flex flex-col gap-1.5">
      <label :for="nameId" class="text-[13px] font-medium text-muted">{{ t('groups.expense.newCategory') }}</label>
      <div class="flex items-start gap-2">
        <InputText
          :id="nameId"
          v-model="form.name"
          data-new-category
          autocomplete="off"
          :invalid="nameInvalid"
          :aria-invalid="nameInvalid || undefined"
          :aria-describedby="nameInvalid ? errorId : undefined"
          class="min-h-11 min-w-0 flex-1"
          @input="onInput"
          @keydown.enter.prevent="add"
          @keydown.esc.stop.prevent="cancel"
        />
        <Button
          type="button"
          :label="t('groups.expense.addCategory')"
          severity="secondary"
          class="min-h-11 shrink-0"
          :loading="addCategory.isPending.value"
          :disabled="addCategory.isPending.value"
          @click="add"
        />
      </div>
      <p v-if="nameInvalid" :id="errorId" class="m-0 text-xs font-medium text-accent">{{ errors[0] }}</p>
    </div>
  </div>
</template>
