<script setup lang="ts">
defineProps<{ message?: string }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <section
    role="alert"
    class="flex flex-col items-center gap-3 rounded-(--radius-card) bg-surface px-6 py-10 text-center"
  >
    <h2 class="m-0 text-base font-semibold">{{ t('shared.error.title') }}</h2>
    <p class="m-0 max-w-sm text-sm text-muted">{{ message ?? t('shared.error.description') }}</p>
    <Button :label="t('shared.actions.retry')" severity="secondary" outlined @click="emit('retry')" />
  </section>
</template>
