<script setup lang="ts">
const emit = defineEmits<{ add: [] }>()
const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="hidden min-h-75 flex-col items-center justify-center gap-2 rounded-(--radius-card) border-[1.5px] border-dashed border-muted/40 bg-transparent text-sm font-semibold text-muted transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:flex"
    @click="emit('add')"
  >
    <AppIcon name="plus" :size="20" />
    {{ t('goals.actions.add') }}
  </button>
</template>
