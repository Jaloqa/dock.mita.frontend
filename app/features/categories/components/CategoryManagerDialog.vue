<script setup lang="ts">
import { type CategoryDto, type CategoryKind, categoryKinds } from '~/shared/api/contract'
import { categoriesOfKind } from '~/shared/categories/select'
import { useCategories } from '~/shared/categories/useCategories'
import { suggestColor } from '../schemas/categorySchema'

type Editing = { kind: CategoryKind; category?: CategoryDto }

const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const notify = useNotify()
const confirm = useConfirm()
const { categories, isPending, isError, refetch } = useCategories()
const { remove, isMissing, refresh } = useCategoryMutations()

const tab = ref<string | number>('expense')
const editing = ref<Editing>()

const activeKind = computed<CategoryKind>(() => (tab.value === 'income' ? 'income' : 'expense'))
const listOf = (kind: CategoryKind) => categoriesOfKind(categories.value, kind)
const takenNames = computed(() => {
  const current = editing.value
  if (!current) return []
  return listOf(current.kind)
    .filter((category) => category.id !== current.category?.id)
    .map((category) => category.name)
})
const defaultColor = computed(() => suggestColor(listOf(activeKind.value)))
const creating = (kind: CategoryKind) =>
  editing.value !== undefined && !editing.value.category && editing.value.kind === kind

watch(visible, (open) => {
  if (open) {
    tab.value = 'expense'
    editing.value = undefined
  }
})

watch(tab, () => {
  editing.value = undefined
})

const root = ref<HTMLElement | null>(null)

async function focusIn(selector: string) {
  await nextTick()
  root.value?.querySelector<HTMLElement>(selector)?.focus()
}

const focusAdd = (kind: CategoryKind) => focusIn(`[data-category-add="${kind}"]`)
const focusEdit = (id: string) => focusIn(`[data-category-edit="${id}"]`)

function stopEditing() {
  const current = editing.value
  editing.value = undefined
  if (current?.category) focusEdit(current.category.id)
  else if (current) focusAdd(current.kind)
}

function focusAfterDelete(category: CategoryDto, neighbour: CategoryDto | undefined) {
  if (neighbour) focusEdit(neighbour.id)
  else focusAdd(category.kind)
}

function confirmDelete(category: CategoryDto) {
  const siblings = listOf(category.kind)
  const index = siblings.findIndex((item) => item.id === category.id)
  const neighbour = siblings[index + 1] ?? siblings[index - 1]
  const other = siblings.find((item) => item.system === 'other')
  confirm.require({
    header: t('categories.confirm.deleteTitle'),
    message: category.inUse
      ? t('categories.confirm.deleteMessage', { name: category.name, other: other?.name ?? '' })
      : t('categories.confirm.deleteUnusedMessage', { name: category.name }),
    acceptLabel: t('categories.actions.confirmDelete'),
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      remove.mutate(category.id, {
        onSuccess: () => {
          if (editing.value?.category?.id === category.id) editing.value = undefined
          focusAfterDelete(category, neighbour)
          notify.success(t('categories.toast.deleted'))
        },
        onError: (error) => {
          notify.error(error)
          if (isMissing(error)) refresh()
        },
      }),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('categories.dialog.title')"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
    :pt="{ content: { class: 'pb-2' } }"
  >
    <div ref="root">
      <Tabs v-model:value="tab">
        <TabList>
          <Tab v-for="kind in categoryKinds" :key="kind" :value="kind" class="min-h-11 flex-1">
            {{ t(`categories.kind.${kind}`) }}
          </Tab>
        </TabList>
        <TabPanels class="px-0 pb-0">
          <TabPanel v-for="kind in categoryKinds" :key="kind" :value="kind" class="flex flex-col gap-3">
            <CategoryEditor
              v-if="creating(kind)"
              :kind="kind"
              :taken-names="takenNames"
              :default-color="defaultColor"
              @done="stopEditing"
              @cancel="stopEditing"
            />
            <Button
              v-else
              text
              class="min-h-11 self-start"
              :data-category-add="kind"
              :disabled="isPending || isError"
              @click="editing = { kind }"
            >
              <AppIcon name="plus" :size="16" :stroke-width="2.2" />
              {{ t('categories.actions.add') }}
            </Button>
            <div class="max-h-[60vh] overflow-y-auto">
              <CategoryList
                :categories="listOf(kind)"
                :label="t(`categories.kind.${kind}`)"
                :is-pending="isPending"
                :is-error="isError"
                :editing-id="editing?.category?.id"
                @retry="refetch"
                @edit="(category) => (editing = { kind: category.kind, category })"
                @remove="confirmDelete"
              >
                <template #editor>
                  <CategoryEditor
                    v-if="editing?.category"
                    :key="editing.category.id"
                    :kind="kind"
                    :category="editing.category"
                    :taken-names="takenNames"
                    :default-color="defaultColor"
                    @done="stopEditing"
                    @cancel="stopEditing"
                  />
                </template>
              </CategoryList>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </Dialog>
</template>
