<script setup lang="ts">
import type { KeypadKey } from '../utils/keypad'

defineProps<{ decimalSeparator: string; allowDecimal: boolean }>()
const emit = defineEmits<{ press: [key: KeypadKey] }>()
const { t } = useI18n()
const keys: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'decimal', '0', 'backspace']

const labelOf = (key: KeypadKey) =>
  key === 'backspace' ? t('transactions.add.backspace') : key === 'decimal' ? t('transactions.add.decimal') : undefined
</script>

<template>
  <fieldset :aria-label="t('transactions.add.keypad')" class="m-0 grid min-w-0 grid-cols-3 gap-1.5 border-0 p-0">
    <template v-for="key in keys" :key="key">
      <span v-if="key === 'decimal' && !allowDecimal" aria-hidden="true" />
      <button
        v-else
        type="button"
        class="flex min-h-12 items-center justify-center rounded-xl bg-bg font-mono text-xl font-medium text-ink active:bg-track"
        :aria-label="labelOf(key)"
        @click="emit('press', key)"
      >
        <AppIcon v-if="key === 'backspace'" name="backspace" :size="22" />
        <template v-else>{{ key === 'decimal' ? decimalSeparator : key }}</template>
      </button>
    </template>
  </fieldset>
</template>
