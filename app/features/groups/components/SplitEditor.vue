<script setup lang="ts">
import type { InputNumberInputEvent } from 'primevue/inputnumber'
import { type GroupMemberDto, type GroupSplitMode, groupSplitModes } from '~/shared/api/contract'
import { type Currency, currencyDigits } from '~/shared/money/currencies'
import { toMinor } from '~/shared/money/money'
import { exactMinors } from '../schemas/expenseSchema'
import { equalPreview, exactLeft } from '../utils/split'

const props = defineProps<{
  members: GroupMemberDto[]
  amount: number | null
  currency: Currency
  payerId: string | null
  errors?: string[]
}>()
const mode = defineModel<GroupSplitMode>('mode', { required: true })
const memberIds = defineModel<string[]>('memberIds', { required: true })
const exact = defineModel<Record<string, number | null>>('exact', { required: true })
const { t, locale } = useI18n()
const { format } = useMoney()

const ID = 'expense-split'
const LEGEND_ID = `${ID}-legend`
const ERROR_ID = `${ID}-error`

const invalid = computed(() => (props.errors?.length ?? 0) > 0)
const amountMinor = computed(() =>
  props.amount !== null && props.amount > 0 ? toMinor(props.amount, props.currency) : 0,
)
const preview = computed(() =>
  equalPreview(
    amountMinor.value,
    memberIds.value,
    props.payerId,
    props.members.map((member) => member.id),
  ),
)
const left = computed(() => exactLeft(amountMinor.value, exactMinors(exact.value, props.currency)))
const leftText = computed(() => {
  if (mode.value !== 'exact' || amountMinor.value === 0 || left.value === 0) return ''
  return left.value > 0
    ? t('groups.expense.left', { amount: format(left.value, props.currency) })
    : t('groups.expense.over', { amount: format(-left.value, props.currency) })
})
const modeOptions = computed(() =>
  groupSplitModes.map((value) => ({
    value,
    label: t(value === 'equal' ? 'groups.expense.splitEqual' : 'groups.expense.splitExact'),
  })),
)
const digits = computed(() => currencyDigits(props.currency))

const checkboxId = (id: string) => `${ID}-member-${id}`
const shareId = (id: string) => `${ID}-share-${id}`
const exactId = (id: string) => `${ID}-exact-${id}`

const shareText = (id: string) =>
  amountMinor.value > 0 && memberIds.value.includes(id) ? format(preview.value[id] ?? 0, props.currency) : ''

const describedBy = (id?: string) => [id, invalid.value ? ERROR_ID : undefined].filter(Boolean).join(' ') || undefined

function setExact(id: string, value: unknown) {
  exact.value = { ...exact.value, [id]: typeof value === 'number' ? value : null }
}

const onExactInput = (id: string, event: InputNumberInputEvent) => setExact(id, event.value)
</script>

<template>
  <fieldset class="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
    <legend :id="LEGEND_ID" class="mb-1.5 p-0 text-[13px] font-medium text-muted">
      {{ t('groups.expense.split') }}
    </legend>
    <SelectButton
      v-model="mode"
      :options="modeOptions"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      :aria-labelledby="LEGEND_ID"
      class="self-start"
      :pt="{ pcToggleButton: { root: { class: 'min-h-11' } } }"
    />
    <ul v-if="mode === 'equal'" class="m-0 flex list-none flex-col p-0">
      <li v-for="member in members" :key="member.id" class="flex min-h-11 items-center gap-3">
        <Checkbox
          v-model="memberIds"
          :value="member.id"
          :input-id="checkboxId(member.id)"
          :invalid="invalid"
          :pt="{ input: { 'aria-describedby': describedBy(shareText(member.id) ? shareId(member.id) : undefined) } }"
        />
        <label
          :for="checkboxId(member.id)"
          class="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center text-sm break-words"
        >
          {{ member.name }}
        </label>
        <span :id="shareId(member.id)" class="shrink-0 font-mono text-sm text-muted">{{ shareText(member.id) }}</span>
      </li>
    </ul>
    <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
      <li
        v-for="member in members"
        :key="member.id"
        class="grid grid-cols-[minmax(0,1fr)_minmax(0,11rem)] items-center gap-3"
      >
        <label :for="exactId(member.id)" class="text-sm break-words">{{ member.name }}</label>
        <InputNumber
          :model-value="exact[member.id] ?? null"
          :input-id="exactId(member.id)"
          mode="currency"
          :currency="currency"
          :locale="locale"
          :min-fraction-digits="digits"
          :max-fraction-digits="digits"
          :min="0"
          :invalid="invalid"
          :pt="{
            pcInputText: { root: { 'aria-describedby': describedBy(), 'aria-invalid': invalid || undefined } },
          }"
          fluid
          @input="onExactInput(member.id, $event)"
          @update:model-value="setExact(member.id, $event)"
        />
      </li>
    </ul>
    <p class="m-0 font-mono text-sm text-muted empty:absolute" aria-live="polite">{{ leftText }}</p>
    <p v-if="invalid" :id="ERROR_ID" class="m-0 text-xs font-medium text-accent">{{ errors?.[0] }}</p>
  </fieldset>
</template>
