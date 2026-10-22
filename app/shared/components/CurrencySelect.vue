<script setup lang="ts">
import type { SelectChangeEvent } from 'primevue/select'
import { CURRENCIES, type Currency, isCurrency } from '~/shared/money/currencies'
import { currencyGroups, currencyOption, pinnedCurrencies } from '~/shared/money/currencyOptions'
import { readRecentCurrencies, rememberCurrency } from '~/shared/money/recentCurrencies'

const SEARCHABLE_ABOVE = 10
const FILTER_FIELDS = ['code', 'name']

const props = withDefaults(
  defineProps<{
    inputId: string
    offered?: readonly Currency[]
    pinned?: readonly Currency[]
    compact?: boolean
    invalid?: boolean
    labelId?: string
    describedBy?: string
    disabled?: boolean
  }>(),
  { offered: () => CURRENCIES, pinned: () => [], compact: false, invalid: false, disabled: false },
)
const model = defineModel<Currency>({ required: true })
const emit = defineEmits<{ change: [currency: Currency] }>()
const { t, locale } = useI18n()

const recent = ref<Currency[]>([])
const searchable = computed(() => props.offered.length > SEARCHABLE_ABOVE)
const groups = computed(() =>
  searchable.value
    ? currencyGroups(locale.value, props.offered, pinnedCurrencies(recent.value, props.pinned, props.offered), {
        pinned: t('shared.currency.pinned'),
        all: t('shared.currency.all'),
      })
    : undefined,
)
const options = computed(() => groups.value ?? props.offered.map((currency) => currencyOption(currency, locale.value)))
const shown = computed(() => (props.compact ? model.value : currencyOption(model.value, locale.value).label))

function readRecent() {
  recent.value = readRecentCurrencies()
}

function onChange(event: SelectChangeEvent) {
  if (!isCurrency(event.value)) return
  rememberCurrency(event.value)
  emit('change', event.value)
}
</script>

<template>
  <Select
    v-model="model"
    :input-id="inputId"
    :options="options"
    option-label="label"
    option-value="value"
    :option-group-label="groups ? 'label' : undefined"
    :option-group-children="groups ? 'items' : undefined"
    :filter="searchable"
    :filter-fields="FILTER_FIELDS"
    :filter-locale="locale"
    :filter-placeholder="t('shared.currency.search')"
    :empty-filter-message="t('shared.currency.empty')"
    reset-filter-on-hide
    :disabled="disabled"
    :invalid="invalid"
    :aria-labelledby="labelId"
    :pt="{
      label: { 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined },
      overlay: { class: 'w-72 max-w-[calc(100vw-2rem)]' },
      option: { class: 'min-h-11' },
      pcFilter: { root: { 'aria-label': t('shared.currency.search'), class: 'min-h-11' } },
    }"
    class="min-h-11"
    fluid
    @before-show="readRecent"
    @change="onChange"
  >
    <template #value>{{ shown }}</template>
  </Select>
</template>
