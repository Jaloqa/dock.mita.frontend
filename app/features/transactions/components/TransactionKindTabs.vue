<script setup lang="ts">
import type { KindFilter } from '../utils/filters'

const props = withDefaults(defineProps<{ variant?: 'segmented' | 'chips' }>(), { variant: 'segmented' })
const model = defineModel<KindFilter>({ required: true })
const { t } = useI18n()
const options: KindFilter[] = ['all', 'expense', 'income']

const optionClass = (option: KindFilter) => {
  const active = model.value === option
  if (props.variant === 'chips') {
    return [
      'min-h-11 rounded-full border px-4 text-[13px] font-semibold',
      active ? 'border-deep bg-deep text-on-deep' : 'border-border bg-surface text-muted',
    ]
  }
  return [
    'min-h-11 rounded-lg px-3.5 text-[13px]',
    active ? 'bg-surface font-semibold text-ink' : 'bg-transparent font-medium text-muted',
  ]
}
</script>

<template>
  <fieldset
    :aria-label="t('transactions.filters.kind')"
    class="m-0 min-w-0 border-0"
    :class="variant === 'chips' ? 'flex flex-wrap gap-2 p-0' : 'flex rounded-(--radius-control) bg-bg p-0.75'"
  >
    <button
      v-for="option in options"
      :key="option"
      type="button"
      :aria-pressed="model === option"
      :class="optionClass(option)"
      @click="model = option"
    >
      {{ t(`transactions.kind.${option}`) }}
    </button>
  </fieldset>
</template>
