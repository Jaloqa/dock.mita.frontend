<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { GoalDto } from '~/shared/api/contract'

const { t } = useI18n()
const { format } = useMoney()
const { page, items, isPending, isError, refetch } = useGoals()

const goalDialogOpen = ref(false)
const contributionOpen = ref(false)
const editing = ref<GoalDto>()
const contributing = ref<GoalDto>()
const addButton = ref<ComponentPublicInstance | null>(null)
const addIconButton = ref<ComponentPublicInstance | null>(null)

const savedCaption = computed(() =>
  page.value ? t('goals.savedCaption', { amount: format(page.value.summary.saved, page.value.currency) }) : undefined,
)

function openCreate() {
  if (!page.value) return
  editing.value = undefined
  goalDialogOpen.value = true
}

function openEdit(goal: GoalDto) {
  editing.value = goal
  goalDialogOpen.value = true
}

function focusAddButton() {
  const target = [addButton.value?.$el, addIconButton.value?.$el].find(
    (element): element is HTMLElement => element instanceof HTMLElement && element.checkVisibility(),
  )
  target?.focus()
}

function openContribution(goal: GoalDto) {
  contributing.value = goal
  contributionOpen.value = true
}

useHead({ title: () => t('navigation.goals') })
</script>

<template>
  <PageHeader :title="t('navigation.goals')">
    <template #eyebrow>
      <span class="hidden lg:inline">{{ t('goals.eyebrow') }}</span>
      <span v-if="savedCaption" class="lg:hidden">{{ savedCaption }}</span>
      <Skeleton v-else-if="isPending" width="8rem" height="1rem" class="lg:hidden!" />
    </template>
    <template #actions>
      <Button ref="addButton" class="hidden! min-h-11 lg:inline-flex!" :disabled="!page" @click="openCreate">
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('goals.actions.add') }}
      </Button>
      <Button
        ref="addIconButton"
        severity="secondary"
        outlined
        class="size-11 lg:hidden!"
        :aria-label="t('goals.actions.add')"
        :disabled="!page"
        @click="openCreate"
      >
        <AppIcon name="plus" :size="20" />
      </Button>
    </template>
  </PageHeader>
  <ErrorState v-if="isError" @retry="refetch" />
  <div v-else-if="isPending || !page" class="flex flex-col gap-6" aria-hidden="true">
    <div class="hidden grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-4 lg:grid">
      <Skeleton v-for="index in 3" :key="index" height="6.5rem" border-radius="16px" />
    </div>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4">
      <Skeleton v-for="index in 3" :key="index" height="12rem" border-radius="16px" />
    </div>
  </div>
  <EmptyState
    v-else-if="items.length === 0"
    :title="t('goals.empty.title')"
    :description="t('goals.empty.description')"
  >
    <template #action>
      <Button :label="t('goals.actions.addFirst')" class="min-h-11" @click="openCreate" />
    </template>
  </EmptyState>
  <template v-else>
    <GoalSummaryCards :summary="page.summary" :currency="page.currency" />
    <section
      :aria-label="t('goals.list.label')"
      class="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4"
    >
      <GoalCard
        v-for="goal in items"
        :key="goal.id"
        :goal="goal"
        :currency="page.currency"
        @contribute="openContribution(goal)"
        @edit="openEdit(goal)"
      />
      <GoalAddTile @add="openCreate" />
    </section>
  </template>
  <GoalDialog
    v-if="page"
    v-model:visible="goalDialogOpen"
    :goal="editing"
    :currency="page.currency"
    @deleted="focusAddButton"
  />
  <GoalContributionDialog v-if="contributing" v-model:visible="contributionOpen" :goal="contributing" />
</template>
