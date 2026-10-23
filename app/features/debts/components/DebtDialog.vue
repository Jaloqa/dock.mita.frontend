<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { InputNumberInputEvent } from 'primevue/inputnumber'
import { useAccounts } from '~/shared/accounts/useAccounts'
import { type DebtDto, type DebtInput, debtDirections } from '~/shared/api/contract'
import { currencyDigits } from '~/shared/money/currencies'
import { fitMajor, fromMinor, toMinor } from '~/shared/money/money'
import { addDaysIso, fromLocalDate, todayIso, toLocalDate } from '~/shared/period/period'
import { useRates } from '~/shared/rates/useRates'
import { useUserSettings } from '~/shared/user/useUserSettings'
import { type DebtForm, debtRules } from '../schemas/debtSchema'
import { convertedPreview } from '../utils/debtView'

const props = defineProps<{ debt?: DebtDto }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ deleted: []; saved: [debt: DebtDto] }>()
const { t, locale } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const confirm = useConfirm()
const server = useServerErrors()
const { accounts, activeAccounts, isPending: accountsPending } = useAccounts()
const { baseCurrency } = useUserSettings()
const { create, update, remove } = useDebtMutations()

const fields = [
  'direction',
  'counterparty',
  'amount',
  'currency',
  'date',
  'dueDate',
  'accountId',
  'rate',
  'note',
] as const
type Field = (typeof fields)[number]

const CURRENCY_HINT_ID = 'debt-currency-hint'

const emptyForm = (): DebtForm => ({
  direction: 'lent',
  counterparty: '',
  amount: null,
  currency: baseCurrency.value,
  date: toLocalDate(todayIso()),
  dueDate: null,
  accountId: null,
  rate: null,
  note: '',
})

const form = reactive<DebtForm>(emptyForm())
const formEl = ref<HTMLFormElement | null>(null)
const rateEdited = ref(false)
const currencyEdited = ref(false)
const deleted = ref(false)
const saved = ref<DebtDto>()
let syncing = false

const isEdit = computed(() => props.debt !== undefined)
const saving = computed(() => create.isPending.value || update.isPending.value || remove.isPending.value)
const currencyLocked = computed(() => (props.debt?.repayments ?? 0) > 0)
const account = computed(() => accounts.value.find((row) => row.id === form.accountId))
const crossCurrency = computed(() => account.value !== undefined && account.value.currency !== form.currency)
const maxDate = computed(() => toLocalDate(addDaysIso(todayIso(), 365)))

const v$ = useVuelidate(
  debtRules(t, {
    crossCurrency: () => crossCurrency.value,
    currency: () => form.currency,
    maxDate: () => maxDate.value,
  }),
  form,
)

const rateDate = computed(() => (form.date ? fromLocalDate(form.date) : todayIso()))
const rates = useRates(() => account.value?.currency ?? baseCurrency.value, { date: rateDate, enabled: crossCurrency })
const suggestedRate = computed(() => (crossCurrency.value ? rates.rateFrom(form.currency) : undefined))

const directionOptions = computed(() =>
  debtDirections.map((direction) => ({ value: direction, label: t(`debts.dialog.${direction}`) })),
)
const accountOptions = computed(() => {
  const own = props.debt?.accountId ? accounts.value.find((row) => row.id === props.debt?.accountId) : undefined
  const list = own?.archived ? [...activeAccounts.value, own] : activeAccounts.value
  return list.map((row) => ({ value: row.id, label: `${row.name} · ${row.currency}` }))
})
const pinnedCurrencies = computed(() => [baseCurrency.value, ...accounts.value.map((row) => row.currency)])
const accountHint = computed(() =>
  t(form.direction === 'lent' ? 'debts.dialog.accountHintLent' : 'debts.dialog.accountHintBorrowed'),
)
const rateCurrencies = computed(() => ({ from: form.currency, to: account.value?.currency ?? '' }))
const accountAmountText = computed(() => {
  const target = account.value
  if (!crossCurrency.value || !target) return undefined
  const amount = convertedPreview(form.amount, form.rate, form.currency, target.currency)
  return amount === undefined ? undefined : t('debts.dialog.accountAmount', { amount: format(amount, target.currency) })
})

watch(suggestedRate, (rate) => {
  if (!syncing && rate !== undefined && !rateEdited.value) form.rate = rate
})

watch([() => form.currency, () => form.accountId], () => {
  if (syncing) return
  rateEdited.value = false
  form.rate = suggestedRate.value ?? null
})

watch(
  () => form.accountId,
  () => {
    if (!syncing && !currencyEdited.value && account.value) form.currency = account.value.currency
  },
)

watch(
  () => form.currency,
  (currency) => {
    if (form.amount !== null) form.amount = fitMajor(form.amount, currency)
  },
)

async function reset() {
  syncing = true
  const debt = props.debt
  Object.assign(
    form,
    debt
      ? {
          direction: debt.direction,
          counterparty: debt.counterparty,
          amount: fromMinor(debt.amount, debt.currency),
          currency: debt.currency,
          date: toLocalDate(debt.date),
          dueDate: debt.dueDate ? toLocalDate(debt.dueDate) : null,
          accountId: debt.accountId,
          rate: debt.rate,
          note: debt.note ?? '',
        }
      : emptyForm(),
  )
  rateEdited.value = debt !== undefined
  currencyEdited.value = debt !== undefined
  deleted.value = false
  saved.value = undefined
  server.clear()
  v$.value.$reset()
  await nextTick()
  syncing = false
}

watch(visible, (open) => {
  if (open) reset()
})

function onAfterHide() {
  const debt = saved.value
  saved.value = undefined
  if (deleted.value) {
    deleted.value = false
    emit('deleted')
  } else if (debt) emit('saved', debt)
}

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

const currencyDescribedBy = (describedBy: string | undefined) =>
  [describedBy, currencyLocked.value ? CURRENCY_HINT_ID : undefined].filter(Boolean).join(' ') || undefined

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
  if (!(await v$.value.$validate()) || !form.date) {
    await nextTick()
    focusFirstInvalid(formEl.value)
    return
  }
  const note = form.note.trim()
  const input: DebtInput = {
    direction: form.direction,
    counterparty: form.counterparty.trim(),
    amount: toMinor(form.amount ?? 0, form.currency),
    currency: form.currency,
    date: fromLocalDate(form.date),
    dueDate: form.dueDate ? fromLocalDate(form.dueDate) : null,
    accountId: form.accountId,
    ...(crossCurrency.value && form.rate !== null ? { rate: form.rate } : {}),
    note: note || null,
  }
  const debt = props.debt
  if (debt) {
    update.mutate(
      { id: debt.id, input },
      {
        onSuccess: (updated) => {
          saved.value = updated
          close(t('debts.toast.updated'))
        },
        onError: showServerErrors,
      },
    )
  } else {
    create.mutate(input, {
      onSuccess: (created) => {
        saved.value = created
        close(t('debts.toast.created'))
      },
      onError: showServerErrors,
    })
  }
}

function confirmDelete() {
  const debt = props.debt
  if (!debt) return
  confirm.require({
    header: t('debts.confirm.deleteTitle'),
    message: t('debts.confirm.deleteMessage', { name: debt.counterparty }),
    acceptLabel: t('debts.actions.delete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(debt.id, {
        onSuccess: () => {
          deleted.value = true
          close(t('debts.toast.deleted'))
        },
        onError: (error) => notify.error(error),
      }),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="isEdit ? t('debts.dialog.editTitle') : t('debts.dialog.createTitle')"
    class="w-[calc(100vw-2rem)] max-w-[32rem]"
    @after-hide="onAfterHide"
  >
    <form id="debt-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="debt-direction" :label="t('debts.dialog.direction')" :errors="errorsOf('direction')">
        <template #default="{ labelId }">
          <SelectButton
            id="debt-direction"
            v-model="form.direction"
            :options="directionOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            :aria-labelledby="labelId"
            :pt="{ pcToggleButton: { root: { class: 'min-h-11' } } }"
          />
        </template>
      </FormRow>
      <FormRow id="debt-counterparty" :label="t('debts.dialog.counterparty')" :errors="errorsOf('counterparty')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="debt-counterparty"
            v-model="form.counterparty"
            autocomplete="off"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch('counterparty')"
          />
        </template>
      </FormRow>
      <div class="flex flex-col gap-1.5">
        <div class="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
          <FormRow id="debt-amount" :label="t('debts.dialog.amount')" :errors="errorsOf('amount')">
            <template #default="{ invalid, describedBy }">
              <InputNumber
                v-model="form.amount"
                input-id="debt-amount"
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
          <FormRow id="debt-currency" :label="t('debts.dialog.currency')" :errors="errorsOf('currency')">
            <template #default="{ invalid, describedBy, labelId }">
              <CurrencySelect
                v-model="form.currency"
                input-id="debt-currency"
                :pinned="pinnedCurrencies"
                compact
                :disabled="currencyLocked"
                :invalid="invalid"
                :label-id="labelId"
                :described-by="currencyDescribedBy(describedBy)"
                @change="onCurrencyChange"
              />
            </template>
          </FormRow>
        </div>
        <p v-if="currencyLocked" :id="CURRENCY_HINT_ID" class="m-0 text-xs text-muted">
          {{ t('debts.dialog.currencyLocked') }}
        </p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
        <FormRow id="debt-date" :label="t('debts.dialog.date')" :errors="errorsOf('date')">
          <template #default="{ invalid, describedBy }">
            <DatePicker
              v-model="form.date"
              input-id="debt-date"
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
        <FormRow
          id="debt-due-date"
          :label="t('debts.dialog.dueDate')"
          :errors="errorsOf('dueDate')"
          :hint="t('debts.dialog.dueDateHint')"
        >
          <template #default="{ invalid, describedBy }">
            <DatePicker
              v-model="form.dueDate"
              input-id="debt-due-date"
              :date-format="t('shared.dateInputFormat')"
              :invalid="invalid"
              :pt="{
                pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } },
              }"
              show-clear
              show-icon
              fluid
              @blur="touch('dueDate')"
            />
          </template>
        </FormRow>
      </div>
      <FormRow id="debt-account" :label="t('debts.dialog.account')" :errors="errorsOf('accountId')" :hint="accountHint">
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.accountId"
            input-id="debt-account"
            :options="accountOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('debts.dialog.accountPlaceholder')"
            :loading="accountsPending"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            show-clear
            fluid
            @change="touch('accountId')"
          />
        </template>
      </FormRow>
      <FormRow
        v-if="crossCurrency"
        id="debt-rate"
        :label="t('debts.dialog.rate', rateCurrencies)"
        :errors="errorsOf('rate')"
        :hint="t('debts.dialog.rateHint', rateCurrencies)"
      >
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.rate"
            input-id="debt-rate"
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
      <p class="m-0 font-mono text-sm text-muted empty:absolute" aria-live="polite">{{ accountAmountText }}</p>
      <FormRow id="debt-note" :label="t('debts.dialog.note')" :errors="errorsOf('note')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="debt-note"
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
        <div>
          <Button
            v-if="debt"
            :label="t('debts.actions.delete')"
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
            form="debt-form"
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
