<script setup lang="ts">
import { canManage, ownerScope } from '~/features/groups/utils/scope'

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const scope = computed(() => ownerScope(String(route.params.id)))
provideGroupScope(scope)
const { group, isPending, isError, notFound, refetch } = useGroup(scope)

const membersOpen = ref(false)
const settingsOpen = ref(false)

const shown = computed(() => (notFound.value || isError.value ? undefined : group.value))
const manageable = computed(() => shown.value !== undefined && canManage(scope.value))
const title = computed(() => shown.value?.name ?? t('groups.page.title'))

const openMembers = () => {
  membersOpen.value = true
}

const openSettings = () => {
  settingsOpen.value = true
}

const onDeleted = () => navigateTo(localePath('/tools/groups'))

useHead({ title: () => title.value })
</script>

<template>
  <PageHeader :title="title">
    <template #eyebrow>
      <NuxtLinkLocale
        to="/tools/groups"
        class="-my-3 inline-flex min-h-11 items-center text-muted no-underline hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {{ t('groups.title') }}
      </NuxtLinkLocale>
    </template>
    <template v-if="manageable" #actions>
      <Button severity="secondary" outlined class="hidden! min-h-11 lg:inline-flex!" @click="openMembers">
        <AppIcon name="groups" :size="16" />
        {{ t('groups.actions.members') }}
      </Button>
      <Button
        severity="secondary"
        outlined
        class="size-11 lg:hidden!"
        :aria-label="t('groups.actions.members')"
        @click="openMembers"
      >
        <AppIcon name="groups" :size="20" />
      </Button>
      <Button severity="secondary" outlined class="hidden! min-h-11 lg:inline-flex!" @click="openSettings">
        <AppIcon name="edit" :size="16" />
        {{ t('groups.actions.edit') }}
      </Button>
      <Button
        severity="secondary"
        outlined
        class="size-11 lg:hidden!"
        :aria-label="t('groups.actions.edit')"
        @click="openSettings"
      >
        <AppIcon name="edit" :size="20" />
      </Button>
    </template>
  </PageHeader>
  <EmptyState v-if="notFound" :title="t('groups.notFound.title')">
    <template #action>
      <NuxtLinkLocale
        to="/tools/groups"
        class="inline-flex min-h-11 items-center text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {{ t('groups.notFound.back') }}
      </NuxtLinkLocale>
    </template>
  </EmptyState>
  <ErrorState v-else-if="isError" @retry="refetch" />
  <GroupSummaryCards v-else-if="group" :group="group" />
  <div
    v-else-if="isPending"
    class="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4"
    aria-hidden="true"
  >
    <Skeleton v-for="index in 2" :key="index" height="6.5rem" border-radius="16px" />
  </div>
  <MembersDialog v-if="group" v-model:visible="membersOpen" :group="group" />
  <GroupDialog v-if="group" v-model:visible="settingsOpen" :group="group" @deleted="onDeleted" />
</template>
