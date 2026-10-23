<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { InputNumberInputEvent } from 'primevue/inputnumber'
import { useAccounts } from '~/shared/accounts/useAccounts'
import type { DebtDto, DebtRepaymentInput } from '~/shared/api/contract'
import { currencyDigits } from '~/shared/money/currencies'
import { fitMajor, fromMinor, toMinor } from '~/shared/money/money'
import { addDaysIso, fromLocalDate, todayIso, toLocalDate } from '~/shared/period/period'
import { useRates } from '~/shared/rates/useRates'
import { useUserSettings } from '~/shared/user/useUserSettings'
import { type RepaymentForm, repaymentRules } from '../schemas/repaymentSchema'
import { convertedPreview } from '../utils/debtView'

const props = defineProps<{ debt: DebtDto }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ settled: [] }>()
const { t, locale } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const server = useServerErrors()
const { accounts, activeAccounts, isPending: accountsPending } = useAccounts()
const { baseCurrency } = useUserSettings()
const { repay } = useDebtMutations()

const fields = ['amount', 'currency', 'date', 'rate', 'accountId', 'note'] as const
type Field = (typeof fields)[number]

const form = reactive<RepaymentForm>({
  amount: null,
  currency: props.debt.currency,
  date: toLocalDate(todayIso()),
  rate: null,
  accountId: null,
  note: '',
})
const formEl = ref<HTMLFormElement | null>(null)
const rateEdited = ref(false)
const accountEdited = ref(false)
const settled = ref(false)

const crossCurrency = computed(() => form.currency !== props.debt.currency)
const maxDate = computed(() => toLocalDate(addDaysIso(todayIso(), 365)))

const v$ = useVuelidate(
  repaymentRules(t, {
    crossCurrency: () => crossCurrency.value,
    currency: () => form.currency,
    maxDate: () => maxDate.value,
    remaining: () => (crossCurrency.value ? undefined : props.debt.remaining),
  }),
  form,
)

const rateDate = computed(() => (form.date ? fromLocalDate(form.date) : todayIso()))
const rates = useRates(() => props.debt.currency, { date: rateDate, enabled: crossCurrency })
const suggestedRate = computed(() => (crossCurrency.value ? rates.rateFrom(form.currency) : undefined))

const title = computed(() =>
  t(props.debt.direction === 'lent' ? 'debts.repayment.titleLent' : 'debts.repayment.titleBorrowed', {
    name: props.debt.counterparty,
  }),
)
const accountOptions = computed(() =>
  activeAccounts.value.map((row) => ({ value: row.id, label: `${row.name} · ${row.currency}` })),
)
const pinnedCurrencies = computed(() => [
  props.debt.currency,
  baseCurrency.value,
  ...accounts.value.map((row) => row.currency),
])
const accountHint = computed(() =>
  t(props.debt.direction === 'lent' ? 'debts.repayment.accountHintLent' : 'debts.repayment.accountHintBorrowed'),
)
const leftText = computed(() =>
  t('debts.repayment.left', { amount: format(props.debt.remaining, props.debt.currency) }),
)
const rateCurrencies = computed(() => ({ from: form.currency, to: props.debt.currency }))
const reducesText = computed(() => {
  if (!crossCurrency.value) return undefined
  const amount = convertedPreview(form.amount, form.rate, form.currency, props.debt.currency)
  return amount === undefined
    ? undefined
    : t('debts.repayment.reduces', { amount: format(amount, props.debt.currency) })
})

const defaultAccountId = () => {
  const id = props.debt.accountId
  return id !== null && activeAccounts.value.some((row) => row.id === id) ? id : null
}

watch(suggestedRate, (rate) => {
  if (rate !== undefined && !rateEdited.value) form.rate = rate
})

watch(
  () => form.currency,
  (currency) => {
    rateEdited.value = false
    form.rate = suggestedRate.value ?? null
    if (form.amount !== null) form.amount = fitMajor(form.amount, currency)
  },
)

watch(activeAccounts, () => {
  if (visible.value && !accountEdited.value && form.accountId === null) form.accountId = defaultAccountId()
})

function reset() {
  Object.assign(form, {
    amount: null,
    currency: props.debt.currency,
    date: toLocalDate(todayIso()),
    rate: null,
    accountId: defaultAccountId(),
    note: '',
  })
  rateEdited.value = false
  accountEdited.value = false
  settled.value = false
  server.clear()
  v$.value.$reset()
}

watch(
  visible,
  (open) => {
    if (open) reset()
  },
  { immediate: true },
)

function onAfterHide() {
  if (!settled.value) return
  settled.value = false
  emit('settled')
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

function onAccountChange() {
  accountEdited.value = true
  touch('accountId')
}

function repayRest() {
  form.currency = props.debt.currency
  form.amount = fromMinor(props.debt.remaining, props.debt.currency)
  touch('amount')
}

async function showServerErrors(error: unknown) {
  if (server.apply(error, fields, crossCurrency.value ? {} : { rate: 'accountId' })) {
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
  const input: DebtRepaymentInput = {
    date: fromLocalDate(form.date),
    amount: toMinor(form.amount ?? 0, form.currency),
    currency: form.currency,
    ...(crossCurrency.value && form.rate !== null ? { rate: form.rate } : {}),
    accountId: form.accountId,
    note: note || null,
  }
  repay.mutate(
    { id: props.debt.id, input },
    {
      onSuccess: (debt) => {
        settled.value = debt.status === 'settled'
        notify.success(t('debts.toast.repaid'))
        visible.value = false
      },
      onError: showServerErrors,
    },
  )
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="title"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
    @after-hide="onAfterHide"
  >
    <form id="repayment-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <div class="flex flex-col gap-1.5">
        <div class="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
          <FormRow id="repayment-amount" :label="t('debts.dialog.amount')" :errors="errorsOf('amount')">
            <template #default="{ invalid, describedBy }">
              <InputNumber
                v-model="form.amount"
                input-id="repayment-amount"
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
          <FormRow id="repayment-currency" :label="t('debts.dialog.currency')" :errors="errorsOf('currency')">
            <template #default="{ invalid, describedBy, labelId }">
              <CurrencySelect
                v-model="form.currency"
                input-id="repayment-currency"
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
        <div class="flex flex-wrap items-center justify-between gap-x-3">
          <p class="m-0 font-mono text-xs text-muted">{{ leftText }}</p>
          <Button :label="t('debts.repayment.rest')" text class="min-h-11" @click="repayRest" />
        </div>
      </div>
      <FormRow id="repayment-date" :label="t('debts.dialog.date')" :errors="errorsOf('date')">
        <template #default="{ invalid, describedBy }">
          <DatePicker
            v-model="form.date"
            input-id="repayment-date"
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
        v-if="crossCurrency"
        id="repayment-rate"
        :label="t('debts.dialog.rate', rateCurrencies)"
        :errors="errorsOf('rate')"
        :hint="t('debts.repayment.rateHint', rateCurrencies)"
      >
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.rate"
            input-id="repayment-rate"
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
      <p class="m-0 font-mono text-sm text-muted empty:absolute" aria-live="polite">{{ reducesText }}</p>
      <FormRow
        id="repayment-account"
        :label="t('debts.dialog.account')"
        :errors="errorsOf('accountId')"
        :hint="accountHint"
      >
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.accountId"
            input-id="repayment-account"
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
            @change="onAccountChange"
          />
        </template>
      </FormRow>
      <FormRow id="repayment-note" :label="t('debts.dialog.note')" :errors="errorsOf('note')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="repayment-note"
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
      <Button
        :label="t('shared.actions.cancel')"
        severity="secondary"
        outlined
        class="min-h-11"
        @click="visible = false"
      />
      <Button
        type="submit"
        form="repayment-form"
        :label="t('shared.actions.save')"
        class="min-h-11"
        :loading="repay.isPending.value"
        :disabled="repay.isPending.value"
      />
    </template>
  </Dialog>
</template>
