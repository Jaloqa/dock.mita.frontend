<script setup lang="ts">
import type { ComponentPublicInstance, Ref } from 'vue'

const props = defineProps<{ canAddExpense: boolean; canRecordRepayment: boolean; hintId: string }>()
const emit = defineEmits<{ addExpense: []; recordRepayment: [] }>()
const { t } = useI18n()

const addExpenseButton = ref<ComponentPublicInstance | null>(null)
const addExpenseIconButton = ref<ComponentPublicInstance | null>(null)
const recordRepaymentButton = ref<ComponentPublicInstance | null>(null)
const recordRepaymentIconButton = ref<ComponentPublicInstance | null>(null)

const addExpenseHint = computed(() => (props.canAddExpense ? undefined : props.hintId))
const recordRepaymentHint = computed(() => (props.canRecordRepayment ? undefined : props.hintId))

function focusFirstVisible(...buttons: Ref<ComponentPublicInstance | null>[]) {
  const target = buttons
    .map((button) => button.value?.$el)
    .find((element): element is HTMLElement => element instanceof HTMLElement && element.checkVisibility())
  target?.focus()
}

const focusAddExpense = () => focusFirstVisible(addExpenseButton, addExpenseIconButton)

function focusRecordRepayment() {
  // The success toast autofocuses its close button while the dialog is closing, and that is not a place to leave the focus.
  const active = document.activeElement
  const kept =
    active instanceof HTMLElement && active !== document.body && active.isConnected && !active.closest('.p-toast')
  if (!kept) focusFirstVisible(recordRepaymentButton, recordRepaymentIconButton)
}

defineExpose({ focusAddExpense, focusRecordRepayment })
</script>

<template>
  <Button
    ref="addExpenseButton"
    class="hidden! min-h-11 lg:inline-flex!"
    :disabled="!canAddExpense"
    :aria-describedby="addExpenseHint"
    @click="emit('addExpense')"
  >
    <AppIcon name="plus" :size="16" :stroke-width="2.2" />
    {{ t('groups.actions.addExpense') }}
  </Button>
  <Button
    ref="addExpenseIconButton"
    class="size-11 lg:hidden!"
    :aria-label="t('groups.actions.addExpense')"
    :disabled="!canAddExpense"
    :aria-describedby="addExpenseHint"
    @click="emit('addExpense')"
  >
    <AppIcon name="plus" :size="20" :stroke-width="2.2" />
  </Button>
  <Button
    ref="recordRepaymentButton"
    severity="secondary"
    outlined
    class="hidden! min-h-11 lg:inline-flex!"
    :disabled="!canRecordRepayment"
    :aria-describedby="recordRepaymentHint"
    @click="emit('recordRepayment')"
  >
    <AppIcon name="transfer" :size="16" />
    {{ t('groups.actions.recordRepayment') }}
  </Button>
  <Button
    ref="recordRepaymentIconButton"
    severity="secondary"
    outlined
    class="size-11 lg:hidden!"
    :aria-label="t('groups.actions.recordRepayment')"
    :disabled="!canRecordRepayment"
    :aria-describedby="recordRepaymentHint"
    @click="emit('recordRepayment')"
  >
    <AppIcon name="transfer" :size="20" />
  </Button>
</template>
