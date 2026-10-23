<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { useAccounts } from '~/shared/accounts/useAccounts'
import { type DebtDto, type DebtStatus, debtStatuses } from '~/shared/api/contract'

const { t } = useI18n()
const status = ref<DebtStatus>('open')
const { page, isError: summaryFailed, refetch: refetchSummary } = useDebts('open')
const { items, isPending: listPending, isError: listFailed, refetch: refetchList } = useDebts(status)
const { accounts } = useAccounts()

const dialogOpen = ref(false)
const editing = ref<DebtDto>()
const repayOpen = ref(false)
const repaying = ref<DebtDto>()
const addButton = ref<ComponentPublicInstance | null>(null)
const addIconButton = ref<ComponentPublicInstance | null>(null)

const failed = computed(() => summaryFailed.value || listFailed.value)
const statusOptions = computed(() => debtStatuses.map((value) => ({ value, label: t(`debts.list.${value}`) })))
const accountName = (id: string | null) => (id ? accounts.value.find((account) => account.id === id)?.name : undefined)

function retry() {
  refetchSummary()
  refetchList()
}

function openCreate() {
  editing.value = undefined
  dialogOpen.value = true
}

function openEdit(debt: DebtDto) {
  editing.value = debt
  dialogOpen.value = true
}

function openRepay(debt: DebtDto) {
  repaying.value = debt
  repayOpen.value = true
}

function focusAddButton() {
  const target = [addButton.value?.$el, addIconButton.value?.$el].find(
    (element): element is HTMLElement => element instanceof HTMLElement && element.checkVisibility(),
  )
  target?.focus()
}

function onSaved(debt: DebtDto) {
  if (debt.status !== status.value) focusAddButton()
}

provideNewDebtFocus(focusAddButton)

useHead({ title: () => t('debts.title') })
</script>

<template>
  <PageHeader :title="t('debts.title')">
    <template #eyebrow>
      <NuxtLinkLocale
        to="/tools"
        class="-my-3 inline-flex min-h-11 items-center text-muted no-underline hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {{ t('navigation.tools') }}
      </NuxtLinkLocale>
    </template>
    <template #actions>
      <Button ref="addButton" class="hidden! min-h-11 lg:inline-flex!" @click="openCreate">
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('debts.actions.add') }}
      </Button>
      <Button
        ref="addIconButton"
        severity="secondary"
        outlined
        class="size-11 lg:hidden!"
        :aria-label="t('debts.actions.add')"
        @click="openCreate"
      >
        <AppIcon name="plus" :size="20" />
      </Button>
    </template>
  </PageHeader>
  <ErrorState v-if="failed" @retry="retry" />
  <template v-else>
    <DebtSummaryCards v-if="page" :summary="page.summary" :currency="page.currency" />
    <div v-else class="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4" aria-hidden="true">
      <Skeleton v-for="index in 3" :key="index" height="6.5rem" border-radius="16px" />
    </div>
    <section aria-labelledby="debts-list-title" class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="debts-list-title" class="m-0 text-base font-semibold">{{ t('debts.list.title') }}</h2>
        <SelectButton
          v-model="status"
          class="mita-segmented"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :aria-label="t('debts.list.status')"
          :pt="{ pcToggleButton: { root: { class: 'min-h-11!' } } }"
        />
      </div>
      <div
        v-if="listPending"
        class="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4"
        aria-hidden="true"
      >
        <Skeleton v-for="index in 3" :key="index" height="12rem" border-radius="16px" />
      </div>
      <EmptyState v-else-if="items.length === 0 && status === 'open'" :title="t('debts.empty.open')">
        <template #action>
          <Button :label="t('debts.actions.addFirst')" class="min-h-11" @click="openCreate" />
        </template>
      </EmptyState>
      <EmptyState v-else-if="items.length === 0" :title="t('debts.empty.settled')" />
      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4">
        <DebtCard
          v-for="debt in items"
          :key="debt.id"
          :debt="debt"
          :account-name="accountName(debt.accountId)"
          @edit="openEdit(debt)"
          @repay="openRepay(debt)"
        />
      </div>
    </section>
    <GroupDebtList />
  </template>
  <DebtDialog v-model:visible="dialogOpen" :debt="editing" @deleted="focusAddButton" @saved="onSaved" />
  <RepaymentDialog v-if="repaying" v-model:visible="repayOpen" :debt="repaying" @settled="focusAddButton" />
</template>
