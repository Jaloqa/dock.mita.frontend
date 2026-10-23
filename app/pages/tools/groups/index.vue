<script setup lang="ts">
import type { GroupDto } from '~/shared/api/contract'

const { t } = useI18n()
const localePath = useLocalePath()
const { items, isPending, isError, refetch } = useGroups()

const dialogOpen = ref(false)
const header = ref<{ focus: () => void } | null>(null)

const focusHeading = () => header.value?.focus()

function openCreate() {
  dialogOpen.value = true
}

function openGroup(group: GroupDto) {
  navigateTo(localePath(`/tools/groups/${encodeURIComponent(group.id)}`))
}

useHead({ title: () => t('groups.title') })
</script>

<template>
  <PageHeader ref="header" :title="t('groups.title')">
    <template #eyebrow>
      <NuxtLinkLocale
        to="/tools"
        class="-my-3 inline-flex min-h-11 items-center text-muted no-underline hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {{ t('navigation.tools') }}
      </NuxtLinkLocale>
    </template>
    <template #actions>
      <Button class="hidden! min-h-11 lg:inline-flex!" @click="openCreate">
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('groups.actions.add') }}
      </Button>
      <Button
        severity="secondary"
        outlined
        class="size-11 lg:hidden!"
        :aria-label="t('groups.actions.add')"
        @click="openCreate"
      >
        <AppIcon name="plus" :size="20" />
      </Button>
    </template>
  </PageHeader>
  <GroupInvites @cleared="focusHeading" />
  <ErrorState v-if="isError" @retry="refetch" />
  <div
    v-else-if="isPending"
    class="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4"
    aria-hidden="true"
  >
    <Skeleton v-for="index in 3" :key="index" height="5.5rem" border-radius="16px" />
  </div>
  <EmptyState v-else-if="items.length === 0" :title="t('groups.empty.title')">
    <template #action>
      <Button :label="t('groups.actions.addFirst')" class="min-h-11" @click="openCreate" />
    </template>
  </EmptyState>
  <ul
    v-else
    :aria-label="t('groups.list.label')"
    class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4 p-0"
  >
    <li v-for="group in items" :key="group.id" class="flex">
      <GroupCard :group="group" />
    </li>
  </ul>
  <GroupDialog v-model:visible="dialogOpen" @created="openGroup" />
</template>
