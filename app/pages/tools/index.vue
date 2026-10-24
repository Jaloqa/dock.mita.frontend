<script setup lang="ts">
import { type ToolKey, tools } from '~/features/tools/utils/tools'

const { t } = useI18n()
const { count } = useToConfirmCount()

const badgeOf = (key: ToolKey) =>
  key === 'groups' && count.value > 0 ? t('groups.toConfirm.count', { count: count.value }, count.value) : undefined

useHead({ title: () => t('navigation.tools') })
</script>

<template>
  <PageHeader :eyebrow="t('tools.eyebrow')" :title="t('navigation.tools')" />
  <ul
    :aria-label="t('tools.list.label')"
    class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4 p-0"
  >
    <li v-for="entry in tools" :key="entry.key" class="flex">
      <ToolCard :entry="entry" :badge="badgeOf(entry.key)" />
    </li>
  </ul>
</template>
