<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <section
    class="flex min-h-60 items-center justify-center rounded-(--radius-card) bg-surface p-6 text-center text-muted"
  >
    {{ t('app.comingSoon') }}
  </section>
</template>
