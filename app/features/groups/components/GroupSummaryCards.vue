<script setup lang="ts">
import type { GroupDto } from '~/shared/api/contract'

defineProps<{ group: GroupDto }>()
const { t, n } = useI18n()
</script>

<template>
  <section
    :aria-label="t('groups.summary.label')"
    class="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4"
  >
    <StatCard data-testid="group-summary-total" :label="t('groups.summary.total')">
      <MoneyText :amount="group.total" :currency="group.currency" />
    </StatCard>
    <StatCard data-testid="group-summary-members" :label="t('groups.summary.members')">
      {{ n(group.members.length) }}
    </StatCard>
  </section>
</template>
