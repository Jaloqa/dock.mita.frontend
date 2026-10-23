<script setup lang="ts">
import type { GroupSummaryDto } from '~/shared/api/contract'

const props = defineProps<{ group: GroupSummaryDto }>()
const { t } = useI18n()

const titleId = computed(() => `group-${props.group.id}-title`)
const factsId = computed(() => `group-${props.group.id}-facts`)
const spentId = computed(() => `group-${props.group.id}-spent`)
const to = computed(() => `/tools/groups/${encodeURIComponent(props.group.id)}`)
</script>

<template>
  <NuxtLinkLocale
    :to="to"
    :aria-labelledby="titleId"
    :aria-describedby="`${factsId} ${spentId}`"
    class="flex min-h-11 w-full min-w-0 items-center justify-between gap-4 rounded-(--radius-card) bg-surface p-4 text-ink no-underline transition-colors hover:bg-surface/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:p-5.5"
  >
    <span class="flex min-w-0 flex-col gap-0.5">
      <span :id="titleId" class="text-base font-semibold break-words lg:text-lg">{{ group.name }}</span>
      <span :id="factsId" class="text-[13px] text-muted">
        {{ t('groups.card.members', { count: group.members }, group.members) }}
        · {{ group.currency }}
      </span>
    </span>
    <span :id="spentId" class="flex shrink-0 flex-col items-end gap-0.5">
      <span class="text-xs font-medium text-muted lg:text-[13px]">{{ t('groups.card.spent') }}</span>
      <MoneyText :amount="group.total" :currency="group.currency" class="text-lg lg:text-[22px]" />
    </span>
  </NuxtLinkLocale>
</template>
