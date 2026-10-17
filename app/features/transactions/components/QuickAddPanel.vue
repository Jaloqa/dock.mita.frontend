<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { InputNumberInputEvent } from 'primevue/inputnumber'
import { useAccounts } from '~/shared/accounts/useAccounts'
import { categoryKinds, type TransactionInput } from '~/shared/api/contract'
import { categorySwatchClass } from '~/shared/categories/colors'
import { useCategories } from '~/shared/categories/useCategories'
import { toMinor } from '~/shared/money/money'
import { addDaysIso, fromLocalDate, todayIso, toLocalDate } from '~/shared/period/period'
import { type TransactionForm, transactionRules } from '../schemas/transactionSchema'

const { t, locale } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const server = useServerErrors()
const {
  accounts,
  activeAccounts,
  isPending: accountsPending,
  isError: accountsError,
  refetch: refetchAccounts,
} = useAccounts()
const {
  categories,
  pickable,
  isPending: categoriesPending,
  isError: categoriesError,
  refetch: refetchCategories,
} = useCategories()
const { create } = useTransactionMutations()

const fields = ['kind', 'amount', 'categoryId', 'accountId', 'date', 'note'] as const
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

const maxDate = computed(() => toLocalDate(addDaysIso(todayIso(), 365)))
const account = computed(() => activeAccounts.value.find((row) => row.id === form.accountId))
const categoryOptions = computed(() => pickable(form.kind))
const selectedCategory = computed(() => categoryOptions.value.find((row) => row.id === form.categoryId))
const accountOptions = computed(() =>
  activeAccounts.value.map((row) => ({ value: row.id, label: `${row.name} · ${row.currency}` })),
)
const loading = computed(() => accountsPending.value || categoriesPending.value)
const accountsFailed = computed(() => accountsError.value && accounts.value.length === 0)
const categoriesFailed = computed(() => categoriesError.value && categories.value.length === 0)
const loadError = computed(() => accountsFailed.value || categoriesFailed.value)
const noAccounts = computed(() => !loading.value && !loadError.value && activeAccounts.value.length === 0)

const v$ = useVuelidate(transactionRules(t, { crossCurrency: () => false, maxDate: () => maxDate.value }), form)

watch(
  categoryOptions,
  (options) => {
    if (!options.some((category) => category.id === form.categoryId)) form.categoryId = options[0]?.id ?? null
  },
  { immediate: true },
)

watch(
  activeAccounts,
  (list) => {
    if (!list.some((row) => row.id === form.accountId)) form.accountId = list[0]?.id ?? null
  },
  { immediate: true },
)

watch(
  account,
  (target) => {
    if (target) form.currency = target.currency
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
  form.amount = typeof event.value === 'number' ? event.value : null
}

function retry() {
  if (accountsFailed.value) refetchAccounts()
  if (categoriesFailed.value) refetchCategories()
}

function reset() {
  form.amount = null
  form.note = ''
  form.date = toLocalDate(todayIso())
  server.clear()
  v$.value.$reset()
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
    categoryId: form.categoryId as string,
    accountId: form.accountId as string,
    amount: toMinor(form.amount ?? 0),
    currency: form.currency,
    ...(note ? { note } : {}),
  }
  create.mutate(input, {
    onSuccess: () => {
      notify.success(t('transactions.toast.created'))
      reset()
    },
    onError: async (error) => {
      if (server.apply(error, fields)) {
        await nextTick()
        focusFirstInvalid(formEl.value)
      } else notify.error(error)
    },
  })
}
</script>

<template>
  <section
    aria-labelledby="quick-add-panel-title"
    class="flex min-w-0 flex-col gap-4 rounded-(--radius-card) bg-surface p-5.5"
  >
    <h2 id="quick-add-panel-title" class="m-0 text-base font-semibold">{{ t('transactions.quickAdd.title') }}</h2>
    <div v-if="loading" class="flex flex-col gap-4" aria-hidden="true">
      <Skeleton height="2.75rem" />
      <Skeleton v-for="index in 4" :key="index" height="4.25rem" />
    </div>
    <ErrorState v-else-if="loadError" @retry="retry" />
    <div v-else-if="noAccounts" class="flex flex-col items-start gap-3">
      <p class="m-0 text-sm text-muted">{{ t('transactions.dialog.noAccounts') }}</p>
      <NuxtLinkLocale to="/accounts" class="inline-flex min-h-11 items-center text-sm font-semibold text-accent">
        {{ t('transactions.dialog.goToAccounts') }}
      </NuxtLinkLocale>
    </div>
    <form v-else ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <fieldset
        :aria-label="t('transactions.dialog.kind')"
        class="m-0 grid min-w-0 grid-cols-2 rounded-(--radius-control) border-0 bg-bg p-0.75"
      >
        <button
          v-for="option in categoryKinds"
          :key="option"
          type="button"
          :aria-pressed="form.kind === option"
          class="min-h-11 rounded-lg text-[13px]"
          :class="form.kind === option ? 'bg-surface font-semibold text-ink' : 'font-medium text-muted'"
          @click="form.kind = option"
        >
          {{ t(`transactions.kindSingle.${option}`) }}
        </button>
      </fieldset>
      <FormRow id="quick-add-panel-amount" :label="t('transactions.dialog.amount')" :errors="errorsOf('amount')">
        <template #default="{ invalid, describedBy }">
          <InputNumber
            v-model="form.amount"
            input-id="quick-add-panel-amount"
            input-class="min-h-12 font-mono! text-xl!"
            :placeholder="format(0, form.currency)"
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
      <FormRow
        id="quick-add-panel-category"
        :label="t('transactions.dialog.category')"
        :errors="errorsOf('categoryId')"
      >
        <template #default="{ invalid, describedBy, labelId }">
          <Select
            v-model="form.categoryId"
            input-id="quick-add-panel-category"
            :options="categoryOptions"
            option-label="name"
            option-value="id"
            :invalid="invalid"
            :aria-labelledby="labelId"
            :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
            fluid
            @change="touch('categoryId')"
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
                <span class="size-2.5 rounded-full" :class="categorySwatchClass(option.color)" aria-hidden="true" />
                {{ option.name }}
              </span>
            </template>
          </Select>
        </template>
      </FormRow>
      <div class="grid grid-cols-2 gap-2.5">
        <FormRow id="quick-add-panel-date" :label="t('transactions.dialog.date')" :errors="errorsOf('date')">
          <template #default="{ invalid, describedBy }">
            <DatePicker
              v-model="form.date"
              input-id="quick-add-panel-date"
              :date-format="t('shared.dateInputFormat')"
              :max-date="maxDate"
              :invalid="invalid"
              :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
              fluid
              @blur="touch('date')"
            />
          </template>
        </FormRow>
        <FormRow id="quick-add-panel-account" :label="t('transactions.dialog.account')" :errors="errorsOf('accountId')">
          <template #default="{ invalid, describedBy, labelId }">
            <Select
              v-model="form.accountId"
              input-id="quick-add-panel-account"
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
      </div>
      <FormRow id="quick-add-panel-note" :label="t('transactions.dialog.note')" :errors="errorsOf('note')">
        <template #default="{ invalid, describedBy }">
          <InputText
            id="quick-add-panel-note"
            v-model="form.note"
            autocomplete="off"
            :placeholder="t('transactions.quickAdd.notePlaceholder')"
            :invalid="invalid"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            fluid
            @blur="touch('note')"
          />
        </template>
      </FormRow>
      <Button
        type="submit"
        :label="t('shared.actions.save')"
        class="min-h-11.5 w-full"
        :loading="create.isPending.value"
        :disabled="create.isPending.value"
      />
    </form>
  </section>
</template>
