<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { InputNumberInputEvent } from 'primevue/inputnumber'
import { useAccounts } from '~/shared/accounts/useAccounts'
import { type CategoryKind, categoryKinds, type TransactionDto, type TransactionInput } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'
import { useCategories } from '~/shared/categories/useCategories'
import { convertMinor, currencies, fromMinor, toMinor } from '~/shared/money/money'
import { addDaysIso, fromLocalDate, todayIso, toLocalDate } from '~/shared/period/period'
import { useRates } from '~/shared/rates/useRates'
import { type TransactionForm, transactionRules } from '../schemas/transactionSchema'

const props = defineProps<{ transaction?: TransactionDto; initialKind?: CategoryKind }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t, locale } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const confirm = useConfirm()
const server = useServerErrors()
const {
  accounts,
  activeAccounts,
  isPending: accountsPending,
  isError: accountsError,
  refetch: refetchAccounts,
} = useAccounts()
const { categories, pickable, nameOf, isError: categoriesError, refetch: refetchCategories } = useCategories()
const { create, update, remove } = useTransactionMutations()

const fields = ['kind', 'amount', 'currency', 'rate', 'categoryId', 'accountId', 'date', 'title', 'note'] as const
type Field = (typeof fields)[number]

const form = reactive<TransactionForm>({
  kind: 'expense',
  amount: null,
  currency: 'PLN',
  rate: null,
  categoryId: null,
  accountId: null,
  date: toLocalDate(todayIso()),
  title: '',
  note: '',
})
const formEl = ref<HTMLFormElement | null>(null)
const rateEdited = ref(false)
const currencyEdited = ref(false)
let syncing = false

const isEdit = computed(() => props.transaction !== undefined)
const saving = computed(() => create.isPending.value || update.isPending.value || remove.isPending.value)
const account = computed(() => accounts.value.find((row) => row.id === form.accountId))
const crossCurrency = computed(() => account.value !== undefined && account.value.currency !== form.currency)
const maxDate = computed(() => toLocalDate(addDaysIso(todayIso(), 365)))
const accountsFailed = computed(() => accountsError.value && accounts.value.length === 0)
const categoriesFailed = computed(() => categoriesError.value && categories.value.length === 0)
const loadError = computed(() => accountsFailed.value || categoriesFailed.value)
const noAccounts = computed(
  () => !isEdit.value && !accountsPending.value && !accountsError.value && activeAccounts.value.length === 0,
)

const v$ = useVuelidate(
  transactionRules(t, { crossCurrency: () => crossCurrency.value, maxDate: () => maxDate.value }),
  form,
)

const rateDate = computed(() => (form.date ? fromLocalDate(form.date) : todayIso()))
const rates = useRates(() => account.value?.currency ?? 'PLN', { date: rateDate, enabled: crossCurrency })
const suggestedRate = computed(() => (crossCurrency.value ? rates.rateFrom(form.currency) : undefined))

const kindOptions = computed(() =>
  categoryKinds.map((kind) => ({ value: kind, label: t(`transactions.kindSingle.${kind}`) })),
)
const categoryOptions = computed(() => pickable(form.kind))
const accountOptions = computed(() => {
  const own = props.transaction ? accounts.value.find((row) => row.id === props.transaction?.accountId) : undefined
  const list = own?.archived ? [...activeAccounts.value, own] : activeAccounts.value
  return list.map((row) => ({ value: row.id, label: `${row.name} · ${row.currency}` }))
})
const rateCurrencies = computed(() => ({ from: form.currency, to: account.value?.currency ?? '' }))
const accountAmountText = computed(() => {
  const target = account.value
  if (!crossCurrency.value || !target || form.amount === null || form.amount <= 0) return undefined
  if (form.rate === null || form.rate <= 0) return undefined
  return t('transactions.dialog.accountAmount', {
    amount: format(convertMinor(toMinor(form.amount), form.rate), target.currency),
  })
})

watch(suggestedRate, (rate) => {
  if (!syncing && rate !== undefined && !rateEdited.value) form.rate = rate
})

watch([() => form.currency, () => account.value?.currency], (_, [, previousAccountCurrency]) => {
  if (syncing) return
  if (previousAccountCurrency === undefined) {
    if (props.transaction) currencyEdited.value = props.transaction.currency !== account.value?.currency
    return
  }
  rateEdited.value = false
  form.rate = suggestedRate.value ?? null
})

watch(
  () => form.accountId,
  () => {
    if (!syncing && !currencyEdited.value && account.value) form.currency = account.value.currency
  },
)

watch(categoryOptions, (options) => {
  if (!syncing && visible.value && !options.some((category) => category.id === form.categoryId)) {
    form.categoryId = options[0]?.id ?? null
  }
})

watch(activeAccounts, (list) => {
  const first = list[0]
  if (!syncing && visible.value && !isEdit.value && form.accountId === null && first) {
    form.accountId = first.id
    form.currency = first.currency
  }
})

async function reset() {
  syncing = true
  const transaction = props.transaction
  const kind = transaction?.kind ?? props.initialKind ?? 'expense'
  const first = activeAccounts.value[0]
  Object.assign(
    form,
    transaction
      ? {
          kind,
          amount: fromMinor(transaction.amount),
          currency: transaction.currency,
          rate: transaction.rate,
          categoryId: transaction.categoryId,
          accountId: transaction.accountId,
          date: toLocalDate(transaction.date),
          title: transaction.title,
          note: transaction.note ?? '',
        }
      : {
          kind,
          amount: null,
          currency: first?.currency ?? 'PLN',
          rate: null,
          categoryId: pickable(kind)[0]?.id ?? null,
          accountId: first?.id ?? null,
          date: toLocalDate(todayIso()),
          title: '',
          note: '',
        },
  )
  rateEdited.value = transaction !== undefined
  currencyEdited.value = transaction !== undefined && transaction.currency !== account.value?.currency
  server.clear()
  v$.value.$reset()
  await nextTick()
  syncing = false
}

watch(
  visible,
  (open) => {
    if (open) reset()
  },
  { immediate: true },
)

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

function touch(field: Field) {
  v$.value[field].$touch()
  server.clear(field)
}

const numberOrNull = (value: unknown) => (typeof value === 'number' ? value : null)

function onAmountInput(event: InputNumberInputEvent) {
  form.amount = numberOrNull(event.value)
}

function onRateInput(event: InputNumberInputEvent) {
  rateEdited.value = true
  form.rate = numberOrNull(event.value)
}

function onCurrencyChange() {
  currencyEdited.value = true
  touch('currency')
}

function retry() {
  if (accountsFailed.value) refetchAccounts()
  if (categoriesFailed.value) refetchCategories()
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
  const note = form.note.trim()
  const input: TransactionInput = {
    kind: form.kind,
    date: fromLocalDate(form.date as Date),
    title: form.title.trim(),
    categoryId: form.categoryId as string,
    accountId: form.accountId as string,
    amount: toMinor(form.amount ?? 0),
    currency: form.currency,
    ...(crossCurrency.value && form.rate !== null ? { rate: form.rate } : {}),
    ...(note ? { note } : {}),
  }
  const transaction = props.transaction
  if (transaction) {
    update.mutate(
      { id: transaction.id, input },
      { onSuccess: () => close(t('transactions.toast.updated')), onError: showServerErrors },
    )
  } else {
    create.mutate(input, { onSuccess: () => close(t('transactions.toast.created')), onError: showServerErrors })
  }
}

function confirmDelete() {
  const transaction = props.transaction
  if (!transaction) return
  confirm.require({
    header: t('transactions.confirm.deleteTitle'),
    message: t('transactions.confirm.deleteMessage', {
      title: transaction.title || (nameOf(transaction.categoryId) ?? ''),
    }),
    acceptLabel: t('transactions.actions.delete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(transaction.id, {
        onSuccess: () => close(t('transactions.toast.deleted')),
        onError: (error) => notify.error(error),
      }),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="isEdit ? t('transactions.dialog.editTitle') : t('transactions.dialog.createTitle')"
    class="w-[calc(100vw-2rem)] max-w-[32rem]"
  >
    <ErrorState v-if="loadError" @retry="retry" />
    <div v-else-if="noAccounts" class="flex flex-col items-start gap-3">
      <p class="m-0 text-sm text-muted">{{ t('transactions.dialog.noAccounts') }}</p>
      <NuxtLinkLocale to="/accounts" class="text-sm font-semibold text-accent" @click="visible = false">
        {{ t('transactions.dialog.goToAccounts') }}
      </NuxtLinkLocale>
    </div>
    <form v-else id="transaction-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="transaction-kind" :label="t('transactions.dialog.kind')" :errors="errorsOf('kind')">
        <template #default="{ labelId }">
          <SelectButton
            id="transaction-kind"
            v-model="form.kind"
            :options="kindOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            :aria-labelledby="labelId"
          />
        </template>
      </FormRow>
      <div class="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
        <FormRow id="transaction-amount" :label="t('transactions.dialog.amount')" :errors="errorsOf('amount')">
          <template #default="{ invalid, describedBy }">
            <InputNumber
              v-model="form.amount"
              input-id="transaction-amount"
              mode="currency"
              :currency="form.currency"
              :locale="locale"
              :min-fraction-digits="2"
              :max-fraction-digits="2"
              :min="0"
              :invalid="invalid"
              :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
              fluid
              @input="onAmountInput"
              @blur="touch('amount')"
            />
          </template>
        </FormRow>
        <FormRow id="transaction-currency" :label="t('transactions.dialog.currency')" :errors="errorsOf('currency')">
          <template #default="{ invalid, describedBy, labelId }">
            <Select
              v-model="form.currency"
              input-id="transaction-currency"
              :options="[...currencies]"
              :invalid="invalid"
              :aria-labelledby="labelId"
              :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
              fluid
              @change="onCurrencyChange"
            />
          </template>
        </FormRow>
      </div>
      <FormRow id="transaction-account" :label="t('transactions.dialog.account')" :errors="errorsOf('accountId')">
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.accountId"
            input-id="transaction-account"
            :options="accountOptions"
            option-label="label"
            option-value="value"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            fluid
            @change="touch('accountId')"
          />
        </template>
      </FormRow>
      <FormRow
        v-if="crossCurrency"
        id="transaction-rate"
        :label="t('transactions.dialog.rate', rateCurrencies)"
        :errors="errorsOf('rate')"
        :hint="t('transactions.dialog.rateHint', rateCurrencies)"
      >
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.rate"
            input-id="transaction-rate"
            :locale="locale"
            :min-fraction-digits="2"
            :max-fraction-digits="6"
            :min="0"
            :invalid="invalid"
            :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
            fluid
            @input="onRateInput"
            @blur="touch('rate')"
          />
        </template>
      </FormRow>
      <p v-if="accountAmountText" class="m-0 font-mono text-sm text-muted" aria-live="polite">
        {{ accountAmountText }}
      </p>
      <FormRow id="transaction-category" :label="t('transactions.dialog.category')" :errors="errorsOf('categoryId')">
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.categoryId"
            input-id="transaction-category"
            :options="categoryOptions"
            option-label="name"
            option-value="id"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            fluid
            @change="touch('categoryId')"
          >
            <template #option="{ option }">
              <span class="flex items-center gap-2">
                <span class="size-2.5 rounded-full" :class="categorySwatchClass(option.color)" aria-hidden="true" />
                {{ option.name }}
              </span>
            </template>
          </Select>
        </template>
      </FormRow>
      <FormRow id="transaction-date" :label="t('transactions.dialog.date')" :errors="errorsOf('date')">
        <template #default="{ invalid, describedBy }">
          <DatePicker
            v-model="form.date"
            input-id="transaction-date"
            :date-format="t('shared.dateInputFormat')"
            :max-date="maxDate"
            :invalid="invalid"
            :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
            show-icon
            fluid
            @blur="touch('date')"
          />
        </template>
      </FormRow>
      <FormRow id="transaction-title" :label="t('transactions.dialog.title')" :errors="errorsOf('title')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="transaction-title"
            v-model="form.title"
            autocomplete="off"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch('title')"
          />
        </template>
      </FormRow>
      <FormRow id="transaction-note" :label="t('transactions.dialog.note')" :errors="errorsOf('note')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="transaction-note"
            v-model="form.note"
            autocomplete="off"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch('note')"
          />
        </template>
      </FormRow>
    </form>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div class="flex gap-2">
          <Button
            v-if="isEdit"
            :label="t('transactions.actions.delete')"
            severity="danger"
            text
            :disabled="saving"
            @click="confirmDelete"
          />
        </div>
        <div class="flex gap-2">
          <Button :label="t('shared.actions.cancel')" severity="secondary" outlined @click="visible = false" />
          <Button
            type="submit"
            form="transaction-form"
            :label="t('shared.actions.save')"
            :loading="saving"
            :disabled="saving || noAccounts || loadError"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>
