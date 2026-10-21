<script setup lang="ts">
const { t } = useI18n()
const notify = useNotify()
const { exporting, exportCsv } = useTransactionExport()
const categoriesOpen = ref(false)
const tagsOpen = ref(false)
const deleteOpen = ref(false)
const apiMode = useApiMode()

useHead({ title: () => t('navigation.settings') })
</script>

<template>
  <PageHeader :eyebrow="t('settings.eyebrow')" :title="t('navigation.settings')" />
  <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-4">
    <ProfileSection />
    <RegionSection />
    <NotificationsSection />
    <DataSection
      :exporting="exporting"
      @export="exportCsv({})"
      @import="notify.info(t('settings.data.importSoon'))"
      @manage-categories="categoriesOpen = true"
      @manage-tags="tagsOpen = true"
      @delete-account="deleteOpen = true"
    />
    <DemoSection v-if="apiMode === 'mock'" />
  </div>
  <CategoryManagerDialog v-model:visible="categoriesOpen" />
  <TagManagerDialog v-model:visible="tagsOpen" />
  <DeleteAccountDialog v-if="apiMode === 'mock'" v-model:visible="deleteOpen" />
  <DeleteAccountPasswordDialog v-else v-model:visible="deleteOpen" />
</template>
