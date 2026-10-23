<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { InputNumberInputEvent } from 'primevue/inputnumber'
import type { GroupDto, GroupExpenseDto, GroupExpenseInput, GroupSplitInput } from '~/shared/api/contract'
import { currencyDigits } from '~/shared/money/currencies'
import { convertMinor, fitMajor, fromMinor, toMinor } from '~/shared/money/money'
import { addDaysIso, fromLocalDate, todayIso, toLocalDate } from '~/shared/period/period'
import { useRates } from '~/shared/rates/useRates'
import { useUserSettings } from '~/shared/user/useUserSettings'
import { type ExpenseForm, expenseRules } from '../schemas/expenseSchema'
import { usedGroupTags } from '../utils/groupTags'

const props = defineProps<{ group: GroupDto; expense?: GroupExpenseDto }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ deleted: [] }>()
const { t, locale } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const confirm = useConfirm()
const server = useServerErrors()
const { baseCurrency } = useUserSettings()
const { create, update, remove, isMissing, refresh } = useExpenseMutations()
const { items: liveExpenses } = useExpenses(false)

const fields = ['payerId', 'amount', 'currency', 'date', 'categoryId', 'tags', 'description', 'rate', 'split'] as const
type Field = Exclude<(typeof fields)[number], 'split'>

const emptyForm = (): ExpenseForm => ({
  payerId: null,
  amount: null,
  currency: props.group.currency,
  date: toLocalDate(todayIso()),
  categoryId: 'other',
  tags: [],
  description: '',
  rate: null,
  splitMode: 'equal',
  memberIds: props.group.members.map((member) => member.id),
  exact: {},
})

const form = reactive<ExpenseForm>(emptyForm())
const formEl = ref<HTMLFormElement | null>(null)
const tagField = ref<{ flush: () => void } | null>(null)
const rateEdited = ref(false)
const deleted = ref(false)
let syncing = false

const isEdit = computed(() => props.expense !== undefined)
const saving = computed(() => create.isPending.value || update.isPending.value || remove.isPending.value)
const crossCurrency = computed(() => form.currency !== props.group.currency)
const keepsManualRate = computed(
  () => props.expense?.rateManual === true && props.expense.currency === form.currency && crossCurrency.value,
)
const maxDate = computed(() => toLocalDate(addDaysIso(todayIso(), 365)))
const amountMinor = computed(() =>
  form.amount !== null && form.amount > 0 ? toMinor(form.amount, form.currency) : undefined,
)

const v$ = useVuelidate(
  expenseRules(t, {
    crossCurrency: () => crossCurrency.value,
    currency: () => form.currency,
    maxDate: () => maxDate.value,
    exactTotal: () => amountMinor.value,
  }),
  form,
)

const rateDate = computed(() => (form.date ? fromLocalDate(form.date) : todayIso()))
const rates = useRates(() => props.group.currency, { date: rateDate, enabled: crossCurrency })
const suggestedRate = computed(() => (crossCurrency.value ? rates.rateFrom(form.currency) : undefined))

const payerOptions = computed(() => props.group.members.map((member) => ({ value: member.id, label: member.name })))
const pinnedCurrencies = computed(() => [props.group.currency, baseCurrency.value])
const rateCurrencies = computed(() => ({ from: form.currency, to: props.group.currency }))
const tagSuggestions = computed(() => usedGroupTags(liveExpenses.value))
const groupAmountText = computed(() => {
  if (!crossCurrency.value || amountMinor.value === undefined || form.rate === null || form.rate <= 0) return undefined
  const amount = convertMinor(amountMinor.value, form.rate, form.currency, props.group.currency)
  return t('groups.expense.groupAmount', { amount: format(amount, props.group.currency) })
})
const splitErrors = computed(() => [
  ...v$.value.memberIds.$errors.map((error) => String(unref(error.$message))),
  ...v$.value.exact.$errors.map((error) => String(unref(error.$message))),
  ...server.messages('split'),
])

watch(suggestedRate, (rate) => {
  if (!syncing && rate !== undefined && !rateEdited.value && !keepsManualRate.value) form.rate = rate
})

watch(
  () => form.currency,
  (currency) => {
    if (form.amount !== null) form.amount = fitMajor(form.amount, currency)
    form.exact = Object.fromEntries(
      Object.entries(form.exact).map(([id, value]) => [id, value === null ? null : fitMajor(value, currency)]),
    )
    if (syncing) return
    rateEdited.value = false
    form.rate = keepsManualRate.value ? (props.expense?.rate ?? null) : (suggestedRate.value ?? null)
  },
)

function formOf(expense: GroupExpenseDto): ExpenseForm {
  const shared = expense.shares.map((share) => share.memberId)
  return {
    payerId: expense.payerId,
    amount: fromMinor(expense.amount, expense.currency),
    currency: expense.currency,
    date: toLocalDate(expense.date),
    categoryId: expense.categoryId,
    tags: [...expense.tags],
    description: expense.description ?? '',
    rate: expense.currency === props.group.currency ? null : expense.rate,
    splitMode: expense.split,
    memberIds: expense.split === 'equal' ? shared : props.group.members.map((member) => member.id),
    exact:
      expense.split === 'exact'
        ? Object.fromEntries(expense.shares.map((share) => [share.memberId, fromMinor(share.amount, expense.currency)]))
        : {},
  }
}

async function reset() {
  syncing = true
  Object.assign(form, props.expense ? formOf(props.expense) : emptyForm())
  rateEdited.value = false
  deleted.value = false
  server.clear()
  v$.value.$reset()
  await nextTick()
  syncing = false
  if (suggestedRate.value !== undefined && !keepsManualRate.value) form.rate = suggestedRate.value
}

watch(visible, (open) => {
  if (open) reset()
})

function onAfterHide() {
  if (!deleted.value) return
  deleted.value = false
  emit('deleted')
}

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

function touch(field: Field) {
  v$.value[field].$touch()
  server.clear(field)
}

const clearSplitErrors = () => server.clear('split')

const numberOrNull = (value: unknown) => (typeof value === 'number' ? value : null)

function onAmountInput(event: InputNumberInputEvent) {
  form.amount = numberOrNull(event.value)
}

function onRateInput(event: InputNumberInputEvent) {
  rateEdited.value = true
  form.rate = numberOrNull(event.value)
}

const close = (message: string) => {
  notify.success(message)
  visible.value = false
}

function fail(error: unknown) {
  notify.error(error)
  if (isMissing(error)) {
    refresh()
    visible.value = false
  }
}

async function showServerErrors(error: unknown) {
  if (server.apply(error, fields)) {
    await nextTick()
    focusFirstInvalid(formEl.value)
  } else fail(error)
}

function splitInput(): GroupSplitInput {
  const order = props.group.members.map((member) => member.id)
  if (form.splitMode === 'equal') {
    return { mode: 'equal', memberIds: order.filter((id) => form.memberIds.includes(id)) }
  }
  return {
    mode: 'exact',
    shares: order.flatMap((memberId) => {
      const value = form.exact[memberId]
      const amount = typeof value === 'number' ? toMinor(value, form.currency) : 0
      return amount > 0 ? [{ memberId, amount }] : []
    }),
  }
}

async function submit() {
  server.clear()
  tagField.value?.flush()
  if (!(await v$.value.$validate()) || !form.date || !form.payerId) {
    await nextTick()
    focusFirstInvalid(formEl.value)
    return
  }
  const description = form.description.trim()
  const sendsRate = crossCurrency.value && (rateEdited.value || keepsManualRate.value)
  const input: GroupExpenseInput = {
    payerId: form.payerId,
    amount: toMinor(form.amount ?? 0, form.currency),
    currency: form.currency,
    date: fromLocalDate(form.date),
    categoryId: form.categoryId,
    tags: form.tags,
    description: description || null,
    ...(sendsRate && form.rate !== null ? { rate: form.rate } : {}),
    split: splitInput(),
  }
  const expense = props.expense
  if (expense) {
    update.mutate(
      { id: expense.id, input },
      { onSuccess: () => close(t('groups.expense.toast.updated')), onError: showServerErrors },
    )
  } else {
    create.mutate(input, { onSuccess: () => close(t('groups.expense.toast.created')), onError: showServerErrors })
  }
}

function confirmDelete() {
  const expense = props.expense
  if (!expense) return
  confirm.require({
    header: t('groups.expense.confirm.deleteTitle'),
    message: t('groups.expense.confirm.deleteMessage'),
    acceptLabel: t('groups.expense.delete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(expense.id, {
        onSuccess: () => {
          deleted.value = true
          close(t('groups.expense.toast.deleted'))
        },
        onError: fail,
      }),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="isEdit ? t('groups.expense.editTitle') : t('groups.expense.createTitle')"
    class="w-[calc(100vw-2rem)] max-w-[34rem]"
    @after-hide="onAfterHide"
  >
    <form id="expense-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="expense-payer" :label="t('groups.expense.payer')" :errors="errorsOf('payerId')">
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.payerId"
            input-id="expense-payer"
            :options="payerOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('groups.expense.payerPlaceholder')"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            class="min-h-11"
            fluid
            @change="touch('payerId')"
          />
        </template>
      </FormRow>
      <div class="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
        <FormRow id="expense-amount" :label="t('groups.expense.amount')" :errors="errorsOf('amount')">
          <template #default="{ invalid, describedBy }">
            <InputNumber
              v-model="form.amount"
              input-id="expense-amount"
              mode="currency"
              :currency="form.currency"
              :locale="locale"
              :min-fraction-digits="currencyDigits(form.currency)"
              :max-fraction-digits="currencyDigits(form.currency)"
              :min="0"
              :invalid="invalid"
              :pt="{
                pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } },
              }"
              fluid
              @input="onAmountInput"
              @blur="touch('amount')"
            />
          </template>
        </FormRow>
        <FormRow id="expense-currency" :label="t('groups.expense.currency')" :errors="errorsOf('currency')">
          <template #default="{ invalid, describedBy, labelId }">
            <CurrencySelect
              v-model="form.currency"
              input-id="expense-currency"
              :pinned="pinnedCurrencies"
              compact
              :invalid="invalid"
              :label-id="labelId"
              :described-by="describedBy"
              @change="touch('currency')"
            />
          </template>
        </FormRow>
      </div>
      <FormRow id="expense-date" :label="t('groups.expense.date')" :errors="errorsOf('date')">
        <template #default="{ invalid, describedBy }">
          <DatePicker
            v-model="form.date"
            input-id="expense-date"
            :date-format="t('shared.dateInputFormat')"
            :max-date="maxDate"
            :invalid="invalid"
            :pt="{
              pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } },
            }"
            show-icon
            fluid
            @blur="touch('date')"
          />
        </template>
      </FormRow>
      <FormRow id="expense-category" :label="t('groups.expense.category')" :errors="errorsOf('categoryId')">
        <template #default="{ invalid, describedBy, labelId }">
          <GroupCategorySelect
            v-model="form.categoryId"
            id="expense-category"
            :group="group"
            :invalid="invalid"
            :label-id="labelId"
            :described-by="describedBy"
            @update:model-value="touch('categoryId')"
          />
        </template>
      </FormRow>
      <FormRow id="expense-tags" :label="t('groups.expense.tags')" :errors="errorsOf('tags')">
        <template #default="{ invalid, describedBy }">
          <GroupTagField
            ref="tagField"
            v-model="form.tags"
            id="expense-tags"
            :suggestions="tagSuggestions"
            :invalid="invalid"
            :described-by="describedBy"
            @update:model-value="touch('tags')"
          />
        </template>
      </FormRow>
      <FormRow id="expense-description" :label="t('groups.expense.description')" :errors="errorsOf('description')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="expense-description"
            v-model="form.description"
            autocomplete="off"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch('description')"
          />
        </template>
      </FormRow>
      <FormRow
        v-if="crossCurrency"
        id="expense-rate"
        :label="t('groups.expense.rate', rateCurrencies)"
        :errors="errorsOf('rate')"
        :hint="t('groups.expense.rateHint')"
      >
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.rate"
            input-id="expense-rate"
            :locale="locale"
            :min-fraction-digits="2"
            :max-fraction-digits="12"
            :min="0"
            :invalid="invalid"
            :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
            fluid
            @input="onRateInput"
            @blur="touch('rate')"
          />
        </template>
      </FormRow>
      <p class="m-0 font-mono text-sm text-muted empty:absolute" aria-live="polite">{{ groupAmountText }}</p>
      <SplitEditor
        v-model:mode="form.splitMode"
        v-model:member-ids="form.memberIds"
        v-model:exact="form.exact"
        :members="group.members"
        :amount="form.amount"
        :currency="form.currency"
        :payer-id="form.payerId"
        :errors="splitErrors"
        @update:mode="clearSplitErrors"
        @update:member-ids="clearSplitErrors"
        @update:exact="clearSplitErrors"
      />
    </form>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div>
          <Button
            v-if="expense"
            :label="t('groups.expense.delete')"
            severity="danger"
            text
            class="min-h-11"
            :disabled="saving"
            @click="confirmDelete"
          />
        </div>
        <div class="flex gap-2">
          <Button
            :label="t('shared.actions.cancel')"
            severity="secondary"
            outlined
            class="min-h-11"
            @click="visible = false"
          />
          <Button
            type="submit"
            form="expense-form"
            :label="t('shared.actions.save')"
            class="min-h-11"
            :loading="saving"
            :disabled="saving"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>
