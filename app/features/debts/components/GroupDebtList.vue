<script setup lang="ts">
import { groupDebtKind } from '../utils/debtView'

const { t } = useI18n()
const { items, isPending, isError, refetch } = useGroupDebts()
const titleId = useId()

const lines = computed(() =>
  items.value.map((group) => ({
    ...group,
    kind: groupDebtKind(group.balance),
    to: `/tools/groups/${encodeURIComponent(group.groupId)}`,
    nameId: `group-debt-${group.groupId}-name`,
    factsId: `group-debt-${group.groupId}-facts`,
    balanceId: `group-debt-${group.groupId}-balance`,
  })),
)
const shown = computed(() => isPending.value || isError.value || lines.value.length > 0)
</script>

<template>
  <section v-if="shown" :aria-labelledby="titleId" :aria-busy="isPending" class="flex flex-col gap-4">
    <h2 :id="titleId" class="m-0 text-base font-semibold">{{ t('debts.groups.title') }}</h2>
    <div
      v-if="isPending"
      class="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4"
      aria-hidden="true"
    >
      <Skeleton height="4.5rem" border-radius="16px" />
    </div>
    <ErrorState v-else-if="isError" compact @retry="refetch()" />
    <ul v-else class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4 p-0">
      <li v-for="line in lines" :key="line.groupId" class="flex min-w-0">
        <NuxtLinkLocale
          :to="line.to"
          :aria-labelledby="line.nameId"
          :aria-describedby="`${line.factsId} ${line.balanceId}`"
          class="flex min-h-11 w-full min-w-0 items-center justify-between gap-4 rounded-(--radius-card) bg-surface p-4 text-ink no-underline transition-colors hover:bg-surface/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:p-5.5"
        >
          <span class="flex min-w-0 flex-col gap-0.5">
            <span :id="line.nameId" class="text-base font-semibold break-words lg:text-lg">{{ line.name }}</span>
            <span :id="line.factsId" class="text-[13px] text-muted">{{ t(`debts.groups.${line.kind}`) }}</span>
          </span>
          <MoneyText
            :id="line.balanceId"
            :amount="line.balance"
            :currency="line.currency"
            signed
            class="shrink-0 text-lg lg:text-[22px]"
          />
        </NuxtLinkLocale>
      </li>
    </ul>
  </section>
</template>
