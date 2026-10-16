<script setup lang="ts">
const dialog = useTransactionDialog()
const mounted = ref(false)
const open = computed({
  get: () => dialog.state.value.open,
  set: (value: boolean) => {
    if (!value) dialog.close()
  },
})

watch(
  open,
  (value) => {
    if (value) mounted.value = true
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-dvh bg-bg print:block! print:min-h-0! print:bg-surface!">
    <AppSidebar @add-transaction="dialog.openCreate()" />
    <main
      class="flex min-w-0 max-w-310 flex-1 flex-col gap-6 px-5 pt-14 pb-28 lg:px-8 lg:pt-7 lg:pb-12 print:max-w-none! print:p-0!"
    >
      <slot />
    </main>
    <AppBottomNav />
    <TransactionDialog
      v-if="mounted"
      v-model:visible="open"
      :transaction="dialog.state.value.transaction"
      :initial-kind="dialog.state.value.kind"
    />
  </div>
</template>
