<script setup lang="ts">
const { t } = useI18n()
const notify = useNotify()
const { exporting, exportCsv } = useTransactionExport()
const categoriesOpen = ref(false)

useHead({ title: () => t('navigation.settings') })
</script>

<template>
  <PageHeader :eyebrow="t('settings.eyebrow')" :title="t('navigation.settings')" />
  <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-4">
    <ProfileSection />
    <RegionSection />
    <DataSection
      :exporting="exporting"
      @export="exportCsv({})"
      @import="notify.info(t('settings.data.importSoon'))"
      @manage-categories="categoriesOpen = true"
    />
  </div>
  <CategoryManagerDialog v-model:visible="categoriesOpen" />
</template>
