<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { InputNumberInputEvent } from 'primevue/inputnumber'
import { useAccounts } from '~/shared/accounts/useAccounts'
import type { TransferInput } from '~/shared/api/contract'
import { currencyDigits } from '~/shared/money/currencies'
import { convertMinor, toMinor } from '~/shared/money/money'
import { addDaysIso, fromLocalDate, todayIso, toLocalDate } from '~/shared/period/period'
import { useRates } from '~/shared/rates/useRates'
import { type TransferForm, transferRules } from '../schemas/transferSchema'

const visible = defineModel<boolean>('visible', { required: true })
const { t, locale } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const server = useServerErrors()
const { activeAccounts } = useAccounts()
const createTransfer = useCreateTransfer()

const fields = ['fromAccountId', 'toAccountId', 'amount', 'date', 'rate', 'note'] as const
type Field = (typeof fields)[number]

const form = reactive<TransferForm>({
  fromAccountId: null,
  toAccountId: null,
  amount: null,
  date: toLocalDate(todayIso()),
  rate: null,
  note: '',
})
const formEl = ref<HTMLFormElement | null>(null)
const rateEdited = ref(false)

const fromAccount = computed(() => activeAccounts.value.find((account) => account.id === form.fromAccountId))
const toAccount = computed(() => activeAccounts.value.find((account) => account.id === form.toAccountId))
const crossCurrency = computed(
  () => !!fromAccount.value && !!toAccount.value && fromAccount.value.currency !== toAccount.value.currency,
)
const amountCurrency = computed(() => fromAccount.value?.currency ?? 'PLN')
const v$ = useVuelidate(
  transferRules(t, form, { crossCurrency: () => crossCurrency.value, currency: () => amountCurrency.value }),
  form,
)

const rateDate = computed(() => (form.date ? fromLocalDate(form.date) : todayIso()))
const rates = useRates(() => toAccount.value?.currency ?? 'PLN', { date: rateDate, enabled: crossCurrency })
const suggestedRate = computed(() =>
  fromAccount.value && crossCurrency.value ? rates.rateFrom(fromAccount.value.currency) : undefined,
)

watch(suggestedRate, (rate) => {
  if (rate !== undefined && !rateEdited.value) form.rate = rate
})

watch([() => fromAccount.value?.currency, () => toAccount.value?.currency], () => {
  rateEdited.value = false
  form.rate = suggestedRate.value ?? null
})

const numberOrNull = (value: unknown) => (typeof value === 'number' ? value : null)

const accountOptions = computed(() =>
  activeAccounts.value.map((account) => ({ value: account.id, label: `${account.name} · ${account.currency}` })),
)
const maxDate = computed(() => toLocalDate(addDaysIso(todayIso(), 365)))
const receives = computed(() => {
  const amount = form.amount
  if (!toAccount.value || amount === null || amount <= 0) return undefined
  const rate = crossCurrency.value ? form.rate : 1
  if (rate === null || rate <= 0) return undefined
  const target = toAccount.value.currency
  return t('accounts.transferDialog.receives', {
    amount: format(convertMinor(toMinor(amount, amountCurrency.value), rate, amountCurrency.value, target), target),
  })
})
const rateCurrencies = computed(() => ({
  from: fromAccount.value?.currency ?? '',
  to: toAccount.value?.currency ?? '',
}))

function reset() {
  const [first, second] = activeAccounts.value
  Object.assign(form, {
    fromAccountId: first?.id ?? null,
    toAccountId: second?.id ?? null,
    amount: null,
    date: toLocalDate(todayIso()),
    note: '',
  })
  rateEdited.value = false
  form.rate = suggestedRate.value ?? null
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

function onAmountInput(event: InputNumberInputEvent) {
  form.amount = numberOrNull(event.value)
}

function onRateInput(event: InputNumberInputEvent) {
  rateEdited.value = true
  form.rate = numberOrNull(event.value)
}

async function submit() {
  server.clear()
  if (!(await v$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(formEl.value)
    return
  }
  const note = form.note.trim()
  const input: TransferInput = {
    date: fromLocalDate(form.date as Date),
    fromAccountId: form.fromAccountId as string,
    toAccountId: form.toAccountId as string,
    fromAmount: toMinor(form.amount ?? 0, amountCurrency.value),
    ...(crossCurrency.value && form.rate !== null ? { rate: form.rate } : {}),
    ...(note ? { note } : {}),
  }
  createTransfer.mutate(input, {
    onSuccess: () => {
      notify.success(t('accounts.toast.transferCreated'))
      visible.value = false
    },
    onError: async (error) => {
      if (server.apply(error, fields, { fromAmount: 'amount' })) {
        await nextTick()
        focusFirstInvalid(formEl.value)
      } else notify.error(error)
    },
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('accounts.transferDialog.title')"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
  >
    <form id="transfer-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="transfer-from" :label="t('accounts.transferDialog.from')" :errors="errorsOf('fromAccountId')">
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.fromAccountId"
            input-id="transfer-from"
            :options="accountOptions"
            option-label="label"
            option-value="value"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            fluid
            @blur="touch('fromAccountId')"
          />
        </template>
      </FormRow>
      <FormRow id="transfer-to" :label="t('accounts.transferDialog.to')" :errors="errorsOf('toAccountId')">
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.toAccountId"
            input-id="transfer-to"
            :options="accountOptions"
            option-label="label"
            option-value="value"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            fluid
            @change="touch('toAccountId')"
          />
        </template>
      </FormRow>
      <FormRow id="transfer-amount" :label="t('accounts.transferDialog.amount')" :errors="errorsOf('amount')">
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.amount"
            input-id="transfer-amount"
            mode="currency"
            :currency="amountCurrency"
            :locale="locale"
            :min-fraction-digits="currencyDigits(amountCurrency)"
            :max-fraction-digits="currencyDigits(amountCurrency)"
            :min="0"
            :invalid="invalid"
            :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
            fluid
            @input="onAmountInput"
            @blur="touch('amount')"
          />
        </template>
      </FormRow>
      <FormRow id="transfer-date" :label="t('accounts.transferDialog.date')" :errors="errorsOf('date')">
        <template #default="{ invalid, describedBy }">
          <DatePicker
            v-model="form.date"
            input-id="transfer-date"
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
      <FormRow
        v-if="crossCurrency"
        id="transfer-rate"
        :label="t('accounts.transferDialog.rate', rateCurrencies)"
        :errors="errorsOf('rate')"
        :hint="t('accounts.transferDialog.rateHint', rateCurrencies)"
      >
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.rate"
            input-id="transfer-rate"
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
      <p v-if="receives" class="m-0 font-mono text-sm text-muted" aria-live="polite">{{ receives }}</p>
      <FormRow id="transfer-note" :label="t('accounts.transferDialog.note')" :errors="errorsOf('note')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="transfer-note"
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
      <Button :label="t('shared.actions.cancel')" severity="secondary" outlined @click="visible = false" />
      <Button
        type="submit"
        form="transfer-form"
        :label="t('shared.actions.save')"
        :loading="createTransfer.isPending.value"
        :disabled="createTransfer.isPending.value"
      />
    </template>
  </Dialog>
</template>
