<script setup lang="ts">
import { categoryKinds } from '~/shared/api/contract'
import { categoriesOfKind } from '~/shared/categories/select'
import { useCategories } from '~/shared/categories/useCategories'

const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const { categories, isPending, isError, refetch } = useCategories()
const tab = ref<string | number>('expense')

watch(visible, (open) => {
  if (open) tab.value = 'expense'
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('categories.dialog.title')"
    class="w-[calc(100vw-2rem)] max-w-[32rem]"
    :pt="{ content: { class: 'pb-2' } }"
  >
    <Tabs v-model:value="tab">
      <TabList>
        <Tab v-for="kind in categoryKinds" :key="kind" :value="kind" class="min-h-11 flex-1">
          {{ t(`categories.kind.${kind}`) }}
        </Tab>
      </TabList>
      <TabPanels class="px-0 pb-0">
        <TabPanel v-for="kind in categoryKinds" :key="kind" :value="kind">
          <div class="max-h-[60vh] overflow-y-auto">
            <CategoryList
              :categories="categoriesOfKind(categories, kind)"
              :label="t(`categories.kind.${kind}`)"
              :is-pending="isPending"
              :is-error="isError"
              @retry="refetch"
            />
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>
