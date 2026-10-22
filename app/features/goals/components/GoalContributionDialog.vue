<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { InputNumberInputEvent } from 'primevue/inputnumber'
import { useAccounts } from '~/shared/accounts/useAccounts'
import type { GoalContributionInput, GoalDto } from '~/shared/api/contract'
import { fieldErrorsOf } from '~/shared/api/problem'
import { AMOUNT_MINOR_MAX, currencyDigits } from '~/shared/money/currencies'
import { fromMinor, toMinor } from '~/shared/money/money'
import { fromLocalDate, todayIso, toLocalDate } from '~/shared/period/period'
import { useRates } from '~/shared/rates/useRates'
import { type ContributionForm, contributionRules } from '../schemas/contributionSchema'
import { contributionSources, receivedAmount } from '../utils/goalView'

const props = defineProps<{ goal: GoalDto }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t, locale } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const server = useServerErrors()
const accounts = useAccounts()
const { contribute } = useGoalMutations()

const fields = ['amount', 'fromAccountId', 'date', 'rate'] as const
type Field = (typeof fields)[number]

const form = reactive<ContributionForm>({
  amount: null,
  fromAccountId: null,
  date: toLocalDate(todayIso()),
  rate: null,
})
const formEl = ref<HTMLFormElement | null>(null)
const rateEdited = ref(false)

const isLinked = computed(() => props.goal.accountId !== null)
const accountsReady = computed(() => !accounts.isPending.value && !accounts.isError.value)
const linkedAccount = computed(() => accounts.accounts.value.find((account) => account.id === props.goal.accountId))
const linkedUnavailable = computed(
  () => isLinked.value && accountsReady.value && (!linkedAccount.value || linkedAccount.value.archived),
)
const sources = computed(() => contributionSources(accounts.accounts.value, props.goal.accountId))
const fromAccount = computed(() => sources.value.find((account) => account.id === form.fromAccountId))
const crossCurrency = computed(
  () => !!fromAccount.value && !!linkedAccount.value && fromAccount.value.currency !== linkedAccount.value.currency,
)
const amountCurrency = computed(() => (isLinked.value ? fromAccount.value?.currency : undefined) ?? props.goal.currency)
const amountMax = computed(() => fromMinor(AMOUNT_MINOR_MAX, amountCurrency.value))
const v$ = useVuelidate(
  contributionRules(t, {
    linked: () => isLinked.value,
    crossCurrency: () => crossCurrency.value,
    currency: () => amountCurrency.value,
  }),
  form,
)

const rateDate = computed(() => (form.date ? fromLocalDate(form.date) : todayIso()))
const rates = useRates(() => linkedAccount.value?.currency ?? props.goal.currency, {
  date: rateDate,
  enabled: crossCurrency,
})
const suggestedRate = computed(() =>
  fromAccount.value && crossCurrency.value ? rates.rateFrom(fromAccount.value.currency) : undefined,
)

watch(suggestedRate, (rate) => {
  if (rate !== undefined && !rateEdited.value) form.rate = rate
})

watch([() => fromAccount.value?.currency, () => linkedAccount.value?.currency], () => {
  rateEdited.value = false
  form.rate = suggestedRate.value ?? null
})

watch(sources, (list) => {
  if (visible.value && isLinked.value && form.fromAccountId === null) form.fromAccountId = list[0]?.id ?? null
})

const sourceOptions = computed(() =>
  sources.value.map((account) => ({ value: account.id, label: `${account.name} · ${account.currency}` })),
)
const maxDate = computed(() => {
  const today = toLocalDate(todayIso())
  const sameDayNextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
  if (sameDayNextYear.getMonth() !== today.getMonth()) sameDayNextYear.setDate(0)
  return sameDayNextYear
})
const preview = computed(() => {
  if (!isLinked.value) return t('goals.contribute.noTransfer')
  if (!fromAccount.value || !linkedAccount.value) return undefined
  return t('goals.contribute.transfer', { from: fromAccount.value.name, to: linkedAccount.value.name })
})
const receives = computed(() => {
  if (!crossCurrency.value || !linkedAccount.value) return undefined
  const amount = receivedAmount(form.amount, form.rate, amountCurrency.value, linkedAccount.value.currency)
  return amount === undefined
    ? undefined
    : t('goals.contribute.receives', { amount: format(amount, linkedAccount.value.currency) })
})
const rateCurrencies = computed(() => ({
  from: fromAccount.value?.currency ?? '',
  to: linkedAccount.value?.currency ?? '',
}))

const numberOrNull = (value: unknown) => (typeof value === 'number' ? value : null)

function reset() {
  Object.assign(form, {
    amount: null,
    fromAccountId: isLinked.value ? (sources.value[0]?.id ?? null) : null,
    date: toLocalDate(todayIso()),
  })
  rateEdited.value = false
  form.rate = suggestedRate.value ?? null
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
  const input: GoalContributionInput = {
    amount: toMinor(form.amount ?? 0, amountCurrency.value),
    date: fromLocalDate(form.date as Date),
    ...(form.fromAccountId ? { fromAccountId: form.fromAccountId } : {}),
    ...(crossCurrency.value && form.rate !== null ? { rate: form.rate } : {}),
  }
  contribute.mutate(
    { id: props.goal.id, input },
    {
      onSuccess: () => {
        notify.success(t('goals.toast.contributed'))
        visible.value = false
      },
      onError: async (error) => {
        if (fieldErrorsOf(error, 'accountId').length > 0) {
          await accounts.refetch()
          if (!linkedUnavailable.value && !accounts.isError.value) notify.error(error)
        } else if (server.apply(error, fields)) {
          await nextTick()
          focusFirstInvalid(formEl.value)
        } else notify.error(error)
      },
    },
  )
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('goals.contribute.title', { name: goal.name })"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
  >
    <ErrorState v-if="accounts.isError.value" @retry="accounts.refetch()" />
    <p v-else-if="linkedUnavailable" role="alert" class="m-0 text-sm text-muted">
      {{ t('goals.contribute.linkedUnavailable') }}
    </p>
    <form v-else id="contribution-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="contribution-amount" :label="t('goals.contribute.amount')" :errors="errorsOf('amount')">
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.amount"
            input-id="contribution-amount"
            mode="currency"
            :currency="amountCurrency"
            :locale="locale"
            :min-fraction-digits="currencyDigits(amountCurrency)"
            :max-fraction-digits="currencyDigits(amountCurrency)"
            :min="0"
            :max="amountMax"
            :disabled="!accountsReady"
            :invalid="invalid"
            :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
            fluid
            @input="onAmountInput"
            @blur="touch('amount')"
          />
        </template>
      </FormRow>
      <FormRow id="contribution-from" :label="t('goals.contribute.from')" :errors="errorsOf('fromAccountId')">
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.fromAccountId"
            input-id="contribution-from"
            :options="sourceOptions"
            option-label="label"
            option-value="value"
            :placeholder="isLinked ? undefined : t('goals.contribute.fromPlaceholder')"
            :show-clear="!isLinked"
            :loading="accounts.isPending.value"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            fluid
            @change="touch('fromAccountId')"
          />
        </template>
      </FormRow>
      <FormRow id="contribution-date" :label="t('goals.contribute.date')" :errors="errorsOf('date')">
        <template #default="{ invalid, describedBy }">
          <DatePicker
            v-model="form.date"
            input-id="contribution-date"
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
        id="contribution-rate"
        :label="t('goals.contribute.rate', rateCurrencies)"
        :errors="errorsOf('rate')"
        :hint="t('goals.contribute.rateHint', rateCurrencies)"
      >
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.rate"
            input-id="contribution-rate"
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
      <p v-if="preview" class="m-0 text-sm text-muted" aria-live="polite">{{ preview }}</p>
      <p v-if="receives" class="m-0 font-mono text-sm text-muted" aria-live="polite">{{ receives }}</p>
    </form>
    <template #footer>
      <Button :label="t('shared.actions.cancel')" severity="secondary" outlined @click="visible = false" />
      <Button
        v-if="!linkedUnavailable && !accounts.isError.value"
        type="submit"
        form="contribution-form"
        :label="t('shared.actions.save')"
        :loading="contribute.isPending.value"
        :disabled="contribute.isPending.value || !accountsReady"
      />
    </template>
  </Dialog>
</template>
