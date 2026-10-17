<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import { useAccounts } from '~/shared/accounts/useAccounts'
import { type CategoryKind, categoryKinds } from '~/shared/api/contract'
import { useCategories } from '~/shared/categories/useCategories'
import { addDaysIso, fromLocalDate, toLocalDate } from '~/shared/period/period'
import { quickAddRules } from '../schemas/transactionSchema'
import { decimalSeparator, entryToMinor, formatEntry, isDigit, type KeypadKey, pressKey } from '../utils/keypad'

const emit = defineEmits<{ close: []; done: [] }>()
const { t, d, locale } = useI18n()
const notify = useNotify()
const server = useServerErrors()
const categories = useCategories()
const accounts = useAccounts()
const { create } = useTransactionMutations()

const fields = ['amount', 'categoryId', 'accountId', 'date'] as const
type Field = (typeof fields)[number]
type ValidatedField = Exclude<Field, 'date'>

const today = useToday()
const maxDate = computed(() => toLocalDate(addDaysIso(today.value, 365)))
const kind = ref<CategoryKind>('expense')
const entry = ref('')
const categoryId = ref<string | null>(null)
const accountId = ref<string | null>(null)
const date = ref(today.value)
const dateOpen = ref(false)
const accountOpen = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const amount = computed(() => entryToMinor(entry.value))
const tiles = computed(() => categories.pickable(kind.value))
const account = computed(() => accounts.activeAccounts.value.find((row) => row.id === accountId.value))
const currency = computed(() => account.value?.currency)
const separator = computed(() => decimalSeparator(locale.value))
const amountText = computed(
  () => `${kind.value === 'expense' ? '−' : '+'}${formatEntry(entry.value, locale.value, currency.value)}`,
)
const loadError = computed(() => categories.isError.value || accounts.isError.value)
const noAccounts = computed(() => !accounts.isPending.value && accounts.activeAccounts.value.length === 0)
const dateLabel = computed(() => {
  if (date.value === today.value) return t('transactions.day.today')
  if (date.value === addDaysIso(today.value, -1)) return t('transactions.day.yesterday')
  return d(new Date(`${date.value}T00:00:00Z`), 'dayMonth')
})

const v$ = useVuelidate(quickAddRules(t), reactive({ amount, categoryId, accountId }))

watch(
  tiles,
  (list) => {
    if (!list.some((category) => category.id === categoryId.value)) categoryId.value = list[0]?.id ?? null
  },
  { immediate: true },
)

watch(
  accounts.activeAccounts,
  (list) => {
    if (!list.some((row) => row.id === accountId.value)) accountId.value = list[0]?.id ?? null
  },
  { immediate: true },
)

const isValidated = (field: Field): field is ValidatedField => field !== 'date'

const errorsOf = (field: Field) => [
  ...(isValidated(field) ? v$.value[field].$errors.map((error) => String(unref(error.$message))) : []),
  ...server.messages(field),
]

const invalid = (field: Field) => errorsOf(field).length > 0

function press(key: KeypadKey) {
  entry.value = pressKey(entry.value, key)
  server.clear('amount')
}

function pickCategory(id: string) {
  categoryId.value = id
  server.clear('categoryId')
}

function keyOf(event: KeyboardEvent): KeypadKey | undefined {
  if (isDigit(event.key)) return event.key
  if (event.key === 'Backspace') return 'backspace'
  if (event.key === ',' || event.key === '.') return 'decimal'
  return undefined
}

function onKeydown(event: KeyboardEvent) {
  if (loadError.value || noAccounts.value || dateOpen.value || accountOpen.value) return
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
  const key = keyOf(event)
  if (!key) return
  event.preventDefault()
  press(key)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function pickDate(value: unknown) {
  if (!(value instanceof Date)) return
  date.value = fromLocalDate(value)
  dateOpen.value = false
  server.clear('date')
}

function pickAccount(id: string) {
  accountId.value = id
  accountOpen.value = false
  server.clear('accountId')
}

function retry() {
  if (categories.isError.value) categories.refetch()
  if (accounts.isError.value) accounts.refetch()
}

async function save() {
  server.clear()
  if (!(await v$.value.$validate())) {
    await nextTick()
    focusFirstInvalid(rootEl.value)
    return
  }
  const target = account.value
  if (!target) return
  create.mutate(
    {
      kind: kind.value,
      date: date.value,
      categoryId: categoryId.value as string,
      accountId: target.id,
      amount: amount.value,
      currency: target.currency,
    },
    {
      onSuccess: () => {
        notify.success(t('transactions.toast.created'))
        emit('done')
      },
      onError: async (error) => {
        if (server.apply(error, fields)) {
          await nextTick()
          focusFirstInvalid(rootEl.value)
        } else notify.error(error)
      },
    },
  )
}
</script>

<template>
  <div ref="rootEl" class="flex flex-auto flex-col gap-3.5">
    <header class="flex items-center justify-between">
      <button
        type="button"
        class="flex size-11 items-center justify-center rounded-xl bg-bg text-ink"
        :aria-label="t('transactions.add.close')"
        @click="emit('close')"
      >
        <AppIcon name="close" :stroke-width="2" />
      </button>
      <h1 class="m-0 text-[17px] font-semibold">{{ t('navigation.addTransaction') }}</h1>
      <span class="size-11" aria-hidden="true" />
    </header>
    <ErrorState v-if="loadError" @retry="retry" />
    <div v-else-if="noAccounts" class="flex flex-col items-start gap-3 py-6">
      <p class="m-0 text-sm text-muted">{{ t('transactions.dialog.noAccounts') }}</p>
      <NuxtLinkLocale to="/accounts" class="text-sm font-semibold text-accent">
        {{ t('transactions.dialog.goToAccounts') }}
      </NuxtLinkLocale>
    </div>
    <template v-else>
      <fieldset
        :aria-label="t('transactions.dialog.kind')"
        class="m-0 grid min-w-0 grid-cols-2 rounded-xl border-0 bg-bg p-0.75"
      >
        <button
          v-for="option in categoryKinds"
          :key="option"
          type="button"
          :aria-pressed="kind === option"
          class="min-h-11 rounded-(--radius-control) text-sm"
          :class="kind === option ? 'bg-surface font-semibold text-ink' : 'font-medium text-muted'"
          @click="kind = option"
        >
          {{ t(`transactions.kindSingle.${option}`) }}
        </button>
      </fieldset>
      <div class="flex flex-col items-center gap-1 py-1.5">
        <span id="quick-add-amount-label" class="text-xs font-medium text-muted">{{
          t('transactions.add.amount')
        }}</span>
        <output
          id="quick-add-amount"
          tabindex="-1"
          aria-labelledby="quick-add-amount-label"
          aria-live="polite"
          :aria-invalid="invalid('amount') || undefined"
          :aria-describedby="invalid('amount') ? 'quick-add-amount-error' : undefined"
          class="font-mono text-[44px] font-medium tracking-tight"
          :class="kind === 'income' ? 'text-accent' : 'text-ink'"
        >
          {{ amountText }}
        </output>
        <p v-if="invalid('amount')" id="quick-add-amount-error" class="m-0 text-xs font-medium text-accent">
          {{ errorsOf('amount')[0] }}
        </p>
      </div>
      <div class="flex flex-col gap-1.5">
        <h2 id="quick-add-categories" class="sr-only">{{ t('transactions.add.categories') }}</h2>
        <div v-if="categories.isPending.value" class="grid grid-cols-4 gap-2" aria-hidden="true">
          <Skeleton v-for="index in 8" :key="index" height="3.25rem" border-radius="12px" />
        </div>
        <fieldset
          v-else
          aria-labelledby="quick-add-categories"
          tabindex="-1"
          :aria-invalid="invalid('categoryId') || undefined"
          :aria-describedby="invalid('categoryId') ? 'quick-add-category-error' : undefined"
          class="m-0 grid min-w-0 grid-cols-4 gap-2 border-0 p-0"
        >
          <button
            v-for="category in tiles"
            :key="category.id"
            type="button"
            :aria-pressed="categoryId === category.id"
            class="min-h-13 rounded-xl border px-1 text-xs font-semibold break-words"
            :class="
              categoryId === category.id ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface text-ink'
            "
            @click="pickCategory(category.id)"
          >
            {{ category.name }}
          </button>
        </fieldset>
        <p v-if="invalid('categoryId')" id="quick-add-category-error" class="m-0 text-xs font-medium text-accent">
          {{ errorsOf('categoryId')[0] }}
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="flex min-w-0 flex-col gap-1">
          <button
            type="button"
            class="flex min-h-11 items-center gap-2 rounded-xl border bg-surface px-3 text-[13px] font-medium text-ink"
            :class="invalid('date') ? 'border-accent' : 'border-border'"
            :aria-label="t('transactions.add.dateButton', { value: dateLabel })"
            :aria-invalid="invalid('date') || undefined"
            :aria-describedby="invalid('date') ? 'quick-add-date-error' : undefined"
            @click="dateOpen = true"
          >
            <AppIcon name="calendar" :size="16" class="text-muted" />
            <span class="truncate">{{ dateLabel }}</span>
          </button>
          <p v-if="invalid('date')" id="quick-add-date-error" class="m-0 text-xs font-medium text-accent">
            {{ errorsOf('date')[0] }}
          </p>
        </div>
        <div class="flex min-w-0 flex-col gap-1">
          <button
            type="button"
            class="flex min-h-11 items-center gap-2 rounded-xl border bg-surface px-3 text-[13px] font-medium text-ink"
            :class="invalid('accountId') ? 'border-accent' : 'border-border'"
            :aria-label="t('transactions.add.accountButton', { value: account?.name ?? '' })"
            :aria-invalid="invalid('accountId') || undefined"
            :aria-describedby="invalid('accountId') ? 'quick-add-account-error' : undefined"
            @click="accountOpen = true"
          >
            <AppIcon name="accounts" :size="16" class="text-muted" />
            <span class="truncate">{{ account?.name }}</span>
          </button>
          <p v-if="invalid('accountId')" id="quick-add-account-error" class="m-0 text-xs font-medium text-accent">
            {{ errorsOf('accountId')[0] }}
          </p>
        </div>
      </div>
      <QuickAddKeypad class="mt-auto" :decimal-separator="separator" @press="press" />
      <Button
        :label="t('shared.actions.save')"
        class="min-h-13 w-full text-[15px]"
        :loading="create.isPending.value"
        :disabled="create.isPending.value"
        @click="save"
      />
    </template>
    <Drawer
      v-model:visible="dateOpen"
      position="bottom"
      :header="t('transactions.add.chooseDate')"
      :aria-label="t('transactions.add.chooseDate')"
      class="h-auto! rounded-t-(--radius-panel)"
    >
      <DatePicker
        :model-value="toLocalDate(date)"
        inline
        :max-date="maxDate"
        class="w-full"
        @update:model-value="pickDate"
      />
    </Drawer>
    <Drawer
      v-model:visible="accountOpen"
      position="bottom"
      :header="t('transactions.add.chooseAccount')"
      :aria-label="t('transactions.add.chooseAccount')"
      class="h-auto! rounded-t-(--radius-panel)"
    >
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <li v-for="option in accounts.activeAccounts.value" :key="option.id">
          <button
            type="button"
            :aria-pressed="option.id === accountId"
            class="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left text-sm font-medium"
            :class="option.id === accountId ? 'border-accent text-ink' : 'border-border text-ink'"
            @click="pickAccount(option.id)"
          >
            <span>{{ option.name }}</span>
            <span class="font-mono text-xs text-muted">{{ option.currency }}</span>
          </button>
        </li>
      </ul>
    </Drawer>
  </div>
</template>
