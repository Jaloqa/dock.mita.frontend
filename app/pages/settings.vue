<script setup lang="ts">
const { t } = useI18n()
const notify = useNotify()
const { exporting, exportCsv } = useTransactionExport()
const categoriesOpen = ref(false)
const deleteOpen = ref(false)
const mocks = useRuntimeConfig().public.apiMocks

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
      :can-delete-account="mocks"
      @export="exportCsv({})"
      @import="notify.info(t('settings.data.importSoon'))"
      @manage-categories="categoriesOpen = true"
      @delete-account="deleteOpen = true"
    />
    <DemoSection v-if="mocks" />
  </div>
  <CategoryManagerDialog v-model:visible="categoriesOpen" />
  <DeleteAccountDialog v-if="mocks" v-model:visible="deleteOpen" />
</template>
