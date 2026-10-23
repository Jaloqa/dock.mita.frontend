<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { InputNumberInputEvent } from 'primevue/inputnumber'
import type { GroupDto, GroupRepaymentDto, GroupRepaymentInput, GroupTransferDto } from '~/shared/api/contract'
import { currencyDigits } from '~/shared/money/currencies'
import { convertMinor, fitMajor, fromMinor, toMinor } from '~/shared/money/money'
import { addDaysIso, fromLocalDate, todayIso, toLocalDate } from '~/shared/period/period'
import { useRates } from '~/shared/rates/useRates'
import { useUserSettings } from '~/shared/user/useUserSettings'
import { type GroupRepaymentForm, groupRepaymentRules } from '../schemas/groupRepaymentSchema'

const props = defineProps<{ group: GroupDto; repayment?: GroupRepaymentDto; prefill?: GroupTransferDto }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ changed: [] }>()
const { t, locale } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const confirm = useConfirm()
const server = useServerErrors()
const { baseCurrency } = useUserSettings()
const { create, update, remove, isMissing, refresh } = useGroupRepaymentMutations()

const fields = ['fromMemberId', 'toMemberId', 'amount', 'currency', 'date', 'rate', 'note'] as const
type Field = (typeof fields)[number]

const emptyForm = (): GroupRepaymentForm => ({
  fromMemberId: props.prefill?.fromMemberId ?? null,
  toMemberId: props.prefill?.toMemberId ?? null,
  amount: props.prefill ? fromMinor(props.prefill.amount, props.group.currency) : null,
  currency: props.group.currency,
  date: toLocalDate(todayIso()),
  rate: null,
  note: '',
})

const form = reactive<GroupRepaymentForm>(emptyForm())
const formEl = ref<HTMLFormElement | null>(null)
const rateEdited = ref(false)
const changed = ref(false)
let syncing = false

const isEdit = computed(() => props.repayment !== undefined)
const saving = computed(() => create.isPending.value || update.isPending.value || remove.isPending.value)
const crossCurrency = computed(() => form.currency !== props.group.currency)
const keepsManualRate = computed(
  () => props.repayment?.rateManual === true && props.repayment.currency === form.currency && crossCurrency.value,
)
const maxDate = computed(() => toLocalDate(addDaysIso(todayIso(), 365)))
const amountMinor = computed(() =>
  form.amount !== null && form.amount > 0 ? toMinor(form.amount, form.currency) : undefined,
)

const v$ = useVuelidate(
  groupRepaymentRules(t, {
    crossCurrency: () => crossCurrency.value,
    currency: () => form.currency,
    maxDate: () => maxDate.value,
  }),
  form,
)

const rateDate = computed(() => (form.date ? fromLocalDate(form.date) : todayIso()))
const rates = useRates(() => props.group.currency, { date: rateDate, enabled: crossCurrency })
const suggestedRate = computed(() => (crossCurrency.value ? rates.rateFrom(form.currency) : undefined))

const memberOptions = computed(() => props.group.members.map((member) => ({ value: member.id, label: member.name })))
const pinnedCurrencies = computed(() => [props.group.currency, baseCurrency.value])
const rateCurrencies = computed(() => ({ from: form.currency, to: props.group.currency }))
const groupAmountText = computed(() => {
  if (!crossCurrency.value || amountMinor.value === undefined || form.rate === null || form.rate <= 0) return undefined
  const amount = convertMinor(amountMinor.value, form.rate, form.currency, props.group.currency)
  return t('groups.repayment.groupAmount', { amount: format(amount, props.group.currency) })
})

watch(suggestedRate, (rate) => {
  if (!syncing && rate !== undefined && !rateEdited.value && !keepsManualRate.value) form.rate = rate
})

watch(
  () => form.currency,
  (currency) => {
    if (form.amount !== null) form.amount = fitMajor(form.amount, currency)
    if (syncing) return
    rateEdited.value = false
    form.rate = keepsManualRate.value ? (props.repayment?.rate ?? null) : (suggestedRate.value ?? null)
  },
)

function formOf(repayment: GroupRepaymentDto): GroupRepaymentForm {
  return {
    fromMemberId: repayment.fromMemberId,
    toMemberId: repayment.toMemberId,
    amount: fromMinor(repayment.amount, repayment.currency),
    currency: repayment.currency,
    date: toLocalDate(repayment.date),
    rate: repayment.currency === props.group.currency ? null : repayment.rate,
    note: repayment.note ?? '',
  }
}

async function reset() {
  syncing = true
  Object.assign(form, props.repayment ? formOf(props.repayment) : emptyForm())
  rateEdited.value = false
  changed.value = false
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
  if (!changed.value) return
  changed.value = false
  emit('changed')
}

const errorsOf = (field: Field) => [
  ...v$.value[field].$errors.map((error) => String(unref(error.$message))),
  ...server.messages(field),
]

function touch(field: Field) {
  v$.value[field].$touch()
  server.clear(field)
}

function onFromChange() {
  touch('fromMemberId')
  server.clear('toMemberId')
  if (form.toMemberId !== null) v$.value.toMemberId.$touch()
}

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
  changed.value = true
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

async function submit() {
  server.clear()
  if (!(await v$.value.$validate()) || !form.date || !form.fromMemberId || !form.toMemberId) {
    await nextTick()
    focusFirstInvalid(formEl.value)
    return
  }
  const note = form.note.trim()
  const sendsRate = crossCurrency.value && (rateEdited.value || keepsManualRate.value)
  const input: GroupRepaymentInput = {
    fromMemberId: form.fromMemberId,
    toMemberId: form.toMemberId,
    amount: toMinor(form.amount ?? 0, form.currency),
    currency: form.currency,
    date: fromLocalDate(form.date),
    ...(sendsRate && form.rate !== null ? { rate: form.rate } : {}),
    note: note || null,
  }
  const repayment = props.repayment
  if (repayment) {
    update.mutate(
      { id: repayment.id, input },
      { onSuccess: () => close(t('groups.repayment.toast.updated')), onError: showServerErrors },
    )
  } else {
    create.mutate(input, { onSuccess: () => close(t('groups.repayment.toast.created')), onError: showServerErrors })
  }
}

function confirmDelete() {
  const repayment = props.repayment
  if (!repayment) return
  confirm.require({
    header: t('groups.repayment.confirm.deleteTitle'),
    message: t('groups.repayment.confirm.deleteMessage'),
    acceptLabel: t('groups.repayment.delete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(repayment.id, {
        onSuccess: () => close(t('groups.repayment.toast.deleted')),
        onError: fail,
      }),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="isEdit ? t('groups.repayment.editTitle') : t('groups.repayment.createTitle')"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
    @after-hide="onAfterHide"
  >
    <form id="group-repayment-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <FormRow id="group-repayment-from" :label="t('groups.repayment.from')" :errors="errorsOf('fromMemberId')">
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.fromMemberId"
            input-id="group-repayment-from"
            :options="memberOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('groups.repayment.fromPlaceholder')"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            class="min-h-11"
            fluid
            @change="onFromChange"
          />
        </template>
      </FormRow>
      <FormRow id="group-repayment-to" :label="t('groups.repayment.to')" :errors="errorsOf('toMemberId')">
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.toMemberId"
            input-id="group-repayment-to"
            :options="memberOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('groups.repayment.toPlaceholder')"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            class="min-h-11"
            fluid
            @change="touch('toMemberId')"
          />
        </template>
      </FormRow>
      <div class="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
        <FormRow id="group-repayment-amount" :label="t('groups.repayment.amount')" :errors="errorsOf('amount')">
          <template #default="{ invalid, describedBy }">
            <InputNumber
              v-model="form.amount"
              input-id="group-repayment-amount"
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
        <FormRow id="group-repayment-currency" :label="t('groups.repayment.currency')" :errors="errorsOf('currency')">
          <template #default="{ invalid, describedBy, labelId }">
            <CurrencySelect
              v-model="form.currency"
              input-id="group-repayment-currency"
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
      <FormRow id="group-repayment-date" :label="t('groups.repayment.date')" :errors="errorsOf('date')">
        <template #default="{ invalid, describedBy }">
          <DatePicker
            v-model="form.date"
            input-id="group-repayment-date"
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
        id="group-repayment-rate"
        :label="t('groups.repayment.rate', rateCurrencies)"
        :errors="errorsOf('rate')"
        :hint="t('groups.repayment.rateHint')"
      >
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.rate"
            input-id="group-repayment-rate"
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
      <FormRow id="group-repayment-note" :label="t('groups.repayment.note')" :errors="errorsOf('note')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="group-repayment-note"
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
            v-if="repayment"
            :label="t('groups.repayment.delete')"
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
            form="group-repayment-form"
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
