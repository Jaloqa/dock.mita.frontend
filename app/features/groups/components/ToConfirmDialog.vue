<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core'
import type { InputNumberInputEvent } from 'primevue/inputnumber'
import { useAccounts } from '~/shared/accounts/useAccounts'
import type { GroupDto, ToConfirmInput, ToConfirmItemDto } from '~/shared/api/contract'
import { isApiError } from '~/shared/api/problem'
import { useCategories } from '~/shared/categories/useCategories'
import { useRates } from '~/shared/rates/useRates'
import { type ConfirmForm, type ConfirmLineForm, confirmRules, NEW_CATEGORY } from '../schemas/confirmSchema'
import { isRepaymentTerms, itemTitle } from '../utils/toConfirmView'

type LineField = 'categoryId' | 'title' | 'tags'

type FieldErrors = Record<string, { $message: unknown }[]>

type Flushable = { flush: () => void }

const props = defineProps<{ item: ToConfirmItemDto; group?: GroupDto | undefined }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ handled: [] }>()
const { t, locale } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const server = useServerErrors()
const { accounts, isPending: accountsPending } = useAccounts()
const { pickable, isPending: categoriesPending } = useCategories()
const { confirm, refresh } = useToConfirmMutations()

const form = reactive<ConfirmForm>({ accountId: null, rate: null, lines: [] })
const formEl = ref<HTMLFormElement | null>(null)
const lineFields = ref<Flushable[]>([])
const rateEdited = ref(false)
const accountEdited = ref(false)
const submitted = ref(false)
const handled = ref(false)

const removed = computed(() => props.item.current === null)
const entryCurrency = computed(() => props.item.current?.currency ?? props.item.groupCurrency)
const title = computed(() => itemTitle(t, props.item, props.group))
const saving = computed(() => confirm.isPending.value)

const accountOptions = computed(() =>
  accounts.value
    .filter((row) => !row.archived || row.id === props.item.suggestedAccountId)
    .map((row) => ({ value: row.id, label: `${row.name} · ${row.currency}` })),
)
const account = computed(() => accounts.value.find((row) => row.id === form.accountId))
const crossCurrency = computed(
  () => !removed.value && !!account.value && account.value.currency !== entryCurrency.value,
)

const rates = useRates(() => account.value?.currency ?? entryCurrency.value, {
  date: () => props.item.current?.date,
  enabled: crossCurrency,
})
const suggestedRate = computed(() => (crossCurrency.value ? rates.rateFrom(entryCurrency.value) : undefined))
const rateCurrencies = computed(() => ({
  from: entryCurrency.value,
  to: account.value?.currency ?? entryCurrency.value,
}))

const categoryOptions = (line: ConfirmLineForm | undefined) => {
  const options = pickable('expense').map((category) => ({ value: category.id, label: category.name }))
  if (line?.newCategory === null || line === undefined) return options
  return [
    { value: NEW_CATEGORY, label: t('groups.toConfirm.line.newCategory', { name: line.newCategory }) },
    ...options,
  ]
}
const tagSuggestions = computed(() => [...new Set(props.item.lines.flatMap((line) => line.suggestion.tags))])

const summary = computed(() => {
  const terms = props.item.current
  if (terms === null) return ''
  const amount = format(terms.amount, terms.currency)
  if (!isRepaymentTerms(terms)) {
    return t('groups.toConfirm.summary.expense', {
      amount,
      share: format(terms.share, terms.currency),
      other: format(props.item.other, terms.currency),
    })
  }
  if (terms.direction === 'paid') return t('groups.toConfirm.summary.paid', { amount })
  const name = props.group?.members.find((member) => member.id === terms.memberId)?.name ?? ''
  return t('groups.toConfirm.summary.received', { name, amount })
})

const v$ = useVuelidate(confirmRules(t, { crossCurrency: () => crossCurrency.value }), form)

const serverFields = computed(() => [
  'accountId',
  'rate',
  'lines',
  ...props.item.lines.flatMap((_, index) =>
    ['categoryId', 'newCategory', 'title', 'tags'].map((field) => `lines.${index}.${field}`),
  ),
])

const messagesOf = (errors: { $message: unknown }[]) => errors.map((error) => String(unref(error.$message)))

const accountErrors = computed(() => [...messagesOf(v$.value.accountId.$errors), ...server.messages('accountId')])
const rateErrors = computed(() => [...messagesOf(v$.value.rate.$errors), ...server.messages('rate')])

function clientLineErrors(index: number, field: LineField): string[] {
  if (!submitted.value) return []
  const lines = v$.value.lines as { $each?: { $response?: { $errors?: FieldErrors[] } } }
  return messagesOf(lines.$each?.$response?.$errors?.[index]?.[field] ?? [])
}

function lineErrors(index: number) {
  const own = (field: string) => server.messages(`lines.${index}.${field}`)
  return {
    categoryId: [...clientLineErrors(index, 'categoryId'), ...own('categoryId'), ...own('newCategory')],
    title: [...clientLineErrors(index, 'title'), ...own('title')],
    tags: [...clientLineErrors(index, 'tags'), ...own('tags')],
  }
}

function touchLine(index: number, field: LineField) {
  for (const name of field === 'categoryId' ? ['categoryId', 'newCategory'] : [field]) {
    server.clear(`lines.${index}.${name}`)
  }
}

function setLineFields(index: number, element: unknown) {
  if (element) lineFields.value[index] = element as Flushable
}

const defaultAccountId = () => {
  const id = props.item.suggestedAccountId
  return id !== null && accountOptions.value.some((option) => option.value === id) ? id : null
}

const lineOf = (line: ToConfirmItemDto['lines'][number]): ConfirmLineForm => ({
  categoryId: line.suggestion.categoryId ?? (line.suggestion.newCategory === null ? null : NEW_CATEGORY),
  newCategory: line.suggestion.newCategory,
  title: line.suggestion.title,
  tags: [...line.suggestion.tags],
})

function reset() {
  Object.assign(form, {
    accountId: defaultAccountId(),
    rate: null,
    lines: props.item.lines.map(lineOf),
  })
  form.rate = suggestedRate.value ?? null
  rateEdited.value = false
  accountEdited.value = false
  submitted.value = false
  handled.value = false
  server.clear()
  v$.value.$reset()
}

watch(suggestedRate, (rate) => {
  if (rate !== undefined && !rateEdited.value) form.rate = rate
})

watch(accountOptions, () => {
  if (visible.value && !accountEdited.value && form.accountId === null) form.accountId = defaultAccountId()
})

watch(
  visible,
  (open) => {
    if (open) reset()
  },
  { immediate: true },
)

function onAccountChange() {
  accountEdited.value = true
  rateEdited.value = false
  form.rate = suggestedRate.value ?? null
  server.clear('accountId')
  server.clear('rate')
}

const numberOrNull = (value: unknown) => (typeof value === 'number' ? value : null)

function onRateInput(event: InputNumberInputEvent) {
  rateEdited.value = true
  form.rate = numberOrNull(event.value)
  server.clear('rate')
}

function inputOf(): ToConfirmInput {
  const { version } = props.item
  if (removed.value) return { version }
  return {
    version,
    accountId: form.accountId,
    ...(crossCurrency.value && form.rate !== null ? { rate: form.rate } : {}),
    lines: form.lines.map((line) => {
      const common = { title: line.title.trim(), tags: line.tags }
      return line.categoryId === NEW_CATEGORY
        ? { newCategory: line.newCategory, ...common }
        : { categoryId: line.categoryId, ...common }
    }),
  }
}

async function showServerErrors(error: unknown) {
  if (isApiError(error) && (error.status === 409 || error.status === 404)) {
    notify.error(error)
    await refresh()
    handled.value = true
    visible.value = false
    return
  }
  if (server.apply(error, serverFields.value, crossCurrency.value ? {} : { rate: 'accountId' })) {
    await nextTick()
    focusFirstInvalid(formEl.value)
  } else notify.error(error)
}

function onAfterHide() {
  if (!handled.value) return
  handled.value = false
  emit('handled')
}

async function submit() {
  if (saving.value) return
  server.clear()
  if (!removed.value) {
    for (const fields of lineFields.value) fields.flush()
    submitted.value = true
    if (!(await v$.value.$validate())) {
      await nextTick()
      focusFirstInvalid(formEl.value)
      return
    }
  }
  confirm.mutate(
    { item: props.item, input: inputOf() },
    {
      onSuccess: () => {
        notify.success(t(removed.value ? 'groups.toConfirm.toast.removed' : 'groups.toConfirm.toast.added'))
        handled.value = true
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
    :header="t('groups.toConfirm.dialog.title', { title })"
    class="w-[calc(100vw-2rem)] max-w-[34rem]"
    @after-hide="onAfterHide"
  >
    <form id="to-confirm-form" ref="formEl" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <p v-if="removed" class="m-0 text-sm text-muted">{{ t('groups.toConfirm.dialog.removed') }}</p>
      <template v-else>
        <p class="m-0 font-mono text-sm break-words">{{ summary }}</p>
        <FormRow id="to-confirm-account" :label="t('groups.toConfirm.dialog.account')" :errors="accountErrors">
          <template #default="{ invalid, describedBy, labelId }">
            <Select
              v-model="form.accountId"
              input-id="to-confirm-account"
              :options="accountOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('groups.toConfirm.dialog.accountPlaceholder')"
              :loading="accountsPending"
              :invalid="invalid"
              :aria-labelledby="labelId"
              :pt="{ label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } }"
              class="min-h-11"
              fluid
              @change="onAccountChange"
            />
          </template>
        </FormRow>
        <FormRow
          v-if="crossCurrency"
          id="to-confirm-rate"
          :label="t('groups.toConfirm.dialog.rate', rateCurrencies)"
          :errors="rateErrors"
          :hint="t('groups.toConfirm.dialog.rateHint')"
        >
          <template #default="{ invalid, describedBy }">
            <InputNumber
              v-model="form.rate"
              input-id="to-confirm-rate"
              :locale="locale"
              :min-fraction-digits="2"
              :max-fraction-digits="12"
              :min="0"
              :invalid="invalid"
              :pt="{ pcInputText: { root: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined } } }"
              fluid
              @input="onRateInput"
            />
          </template>
        </FormRow>
        <template v-for="(line, index) in item.lines" :key="line.expenseId">
          <ConfirmLineFields
            v-if="form.lines[index]"
            :ref="(element) => setLineFields(index, element)"
            v-model="form.lines[index]"
            :line="line"
            :index="index"
            :legend="line.description ?? item.groupName"
            :categories="categoryOptions(form.lines[index])"
            :tag-suggestions="tagSuggestions"
            :errors="lineErrors(index)"
            :loading="categoriesPending"
            @touch="(field) => touchLine(index, field)"
          />
        </template>
      </template>
      <p
        v-for="message in server.messages('lines')"
        :key="message"
        role="alert"
        class="m-0 text-xs font-medium text-accent"
      >
        {{ message }}
      </p>
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
        form="to-confirm-form"
        :label="t('groups.toConfirm.confirm')"
        class="min-h-11"
        :loading="saving"
        :disabled="saving"
      />
    </template>
  </Dialog>
</template>
