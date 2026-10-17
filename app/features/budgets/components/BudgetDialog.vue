<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { BudgetDto, BudgetInput, CategoryDto } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'
import { type Currency, fromMinor, toMinor } from '~/shared/money/money'
import { BUDGET_LIMIT_MAX, type BudgetForm, budgetRules } from '../schemas/budgetSchema'

const props = defineProps<{
  budget?: BudgetDto
  categoryName?: string
  period: string
  categories: CategoryDto[]
  currency: Currency
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ manageCategories: [] }>()
const { t, locale } = useI18n()
const notify = useNotify()
const confirm = useConfirm()
const server = useServerErrors()
const { create, update, remove } = useBudgetMutations()

const fields = ['categoryId', 'limit'] as const
type Field = (typeof fields)[number]

const form = reactive<BudgetForm>({ categoryId: null, limit: null })
const v$ = useVuelidate(budgetRules(t), form)
const formEl = ref<HTMLFormElement | null>(null)

const isEdit = computed(() => props.budget !== undefined)
const selectedCategory = computed(() => props.categories.find((row) => row.id === form.categoryId))
const noChoices = computed(() => !isEdit.value && props.categories.length === 0)
const saving = computed(() => create.isPending.value || update.isPending.value || remove.isPending.value)

function reset() {
  const budget = props.budget
  Object.assign(
    form,
    budget ? { categoryId: budget.categoryId, limit: fromMinor(budget.limit) } : { categoryId: null, limit: null },
  )
  server.clear()
  v$.value.$reset()
}

watch(visible, (open) => {
  if (open) reset()
})

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

function touch(field: Field) {
  v$.value[field].$touch()
  server.clear(field)
}

const close = (message: string) => {
  notify.success(message)
  visible.value = false
}

async function showServerErrors(error: unknown) {
  if (server.apply(error, fields)) {
    await nextTick()
    focusFirstInvalid(formEl.value)
  } else notify.error(error)
}

async function submit() {
  server.clear()
  if (!(await v$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(formEl.value)
    return
  }
  const budget = props.budget
  const input: BudgetInput = {
    categoryId: form.categoryId ?? '',
    period: budget?.period ?? props.period,
    limit: toMinor(form.limit ?? 0),
  }
  if (budget) {
    update.mutate(
      { id: budget.id, input },
      { onSuccess: () => close(t('budgets.toast.updated')), onError: showServerErrors },
    )
  } else {
    create.mutate(input, { onSuccess: () => close(t('budgets.toast.created')), onError: showServerErrors })
  }
}

function confirmDelete() {
  const budget = props.budget
  if (!budget) return
  confirm.require({
    header: t('budgets.confirm.deleteTitle'),
    message: t('budgets.confirm.deleteMessage', { name: props.categoryName ?? '' }),
    acceptLabel: t('budgets.actions.delete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(budget.id, {
        onSuccess: () => close(t('budgets.toast.deleted')),
        onError: (error) => notify.error(error),
      }),
  })
}

function manageCategories() {
  visible.value = false
  emit('manageCategories')
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="isEdit ? t('budgets.dialog.editTitle') : t('budgets.dialog.createTitle')"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
  >
    <div v-if="noChoices" class="flex flex-col items-start gap-3">
      <p class="m-0 text-sm text-muted">{{ t('budgets.dialog.noCategories') }}</p>
      <Button
        :label="t('budgets.actions.manageCategories')"
        severity="secondary"
        outlined
        class="min-h-11"
        @click="manageCategories"
      />
    </div>
    <form v-else id="budget-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="budget-category" :label="t('budgets.dialog.category')" :errors="errorsOf('categoryId')">
        <template #default="{ invalid, describedBy, labelId }">
          <InputText v-if="budget" id="budget-category" :model-value="categoryName" readonly fluid />
          <Select
            v-else
            v-model="form.categoryId"
            input-id="budget-category"
            :options="categories"
            option-label="name"
            option-value="id"
            :placeholder="t('budgets.dialog.categoryPlaceholder')"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            fluid
            @hide="touch('categoryId')"
          >
            <template #value="{ placeholder }">
              <span v-if="selectedCategory" class="flex items-center gap-2">
                <span
                  class="size-2.5 shrink-0 rounded-full"
                  :class="categorySwatchClass(selectedCategory.color)"
                  aria-hidden="true"
                />
                {{ selectedCategory.name }}
              </span>
              <template v-else>{{ placeholder ?? ' ' }}</template>
            </template>
            <template #option="{ option }">
              <span class="flex items-center gap-2">
                <span
                  class="size-2.5 shrink-0 rounded-full"
                  :class="categorySwatchClass(option.color)"
                  aria-hidden="true"
                />
                {{ option.name }}
              </span>
            </template>
          </Select>
        </template>
      </FormRow>
      <FormRow id="budget-limit" :label="t('budgets.dialog.limit')" :errors="errorsOf('limit')">
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.limit"
            input-id="budget-limit"
            mode="currency"
            :currency="currency"
            :locale="locale"
            :min-fraction-digits="2"
            :max-fraction-digits="2"
            :max="BUDGET_LIMIT_MAX"
            :invalid="invalid"
            :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
            fluid
            @blur="touch('limit')"
          />
        </template>
      </FormRow>
    </form>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div>
          <Button
            v-if="budget"
            :label="t('budgets.actions.delete')"
            severity="danger"
            text
            :disabled="saving"
            @click="confirmDelete"
          />
        </div>
        <div class="flex gap-2">
          <Button :label="t('shared.actions.cancel')" severity="secondary" outlined @click="visible = false" />
          <Button
            v-if="!noChoices"
            type="submit"
            form="budget-form"
            :label="t('shared.actions.save')"
            :loading="saving"
            :disabled="saving"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>
