<script setup lang="ts">
withDefaults(defineProps<{ id: string; variant?: 'field' | 'bar' }>(), { variant: 'field' })
const model = defineModel<string>({ required: true })
const { t } = useI18n()
const draft = ref(model.value)
let timer: ReturnType<typeof setTimeout> | undefined

watch(draft, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    model.value = value
  }, 300)
})

watch(model, (value) => {
  if (value !== draft.value) draft.value = value
})

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <label v-if="variant === 'field'" :for="id" class="flex min-w-0 flex-col gap-1.5 text-[13px] font-medium text-muted">
    {{ t('transactions.filters.search') }}
    <InputText
      :id="id"
      v-model="draft"
      type="search"
      autocomplete="off"
      :placeholder="t('transactions.filters.searchPlaceholder')"
      fluid
    />
  </label>
  <label
    v-else
    :for="id"
    class="flex min-h-11.5 items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 text-muted focus-within:border-accent"
  >
    <AppIcon name="search" />
    <span class="sr-only">{{ t('transactions.filters.search') }}</span>
    <input
      :id="id"
      v-model="draft"
      type="search"
      autocomplete="off"
      :placeholder="t('transactions.filters.searchPlaceholder')"
      class="min-w-0 flex-auto border-0 bg-transparent text-[15px] text-ink outline-none"
    >
  </label>
</template>
