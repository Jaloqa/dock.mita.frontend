<script setup lang="ts">
import { ownerScope } from '~/features/groups/utils/scope'

const { t } = useI18n()
const route = useRoute()
const scope = computed(() => ownerScope(String(route.params.id)))
const { group, isPending, isError, notFound, refetch } = useGroup(scope)

const title = computed(() => group.value?.name ?? t('groups.page.title'))

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
  <Skeleton v-else-if="isPending" height="6.5rem" border-radius="16px" aria-hidden="true" />
</template>
