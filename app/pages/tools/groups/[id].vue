<script setup lang="ts">
import type { ComponentPublicInstance, Ref } from 'vue'
import { entryAccess } from '~/features/groups/utils/groupView'
import { canManage, ownerScope } from '~/features/groups/utils/scope'
import type { GroupExpenseDto, GroupRepaymentDto, GroupTransferDto } from '~/shared/api/contract'

const HINT_ID = 'group-entry-hint'

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const scope = computed(() => ownerScope(String(route.params.id)))
provideGroupScope(scope)
const { group, isPending, isError, notFound, refetch } = useGroup(scope)

const membersOpen = ref(false)
const shareOpen = ref(false)
const settingsOpen = ref(false)
const expenseOpen = ref(false)
const editedExpense = ref<GroupExpenseDto>()
const repaymentOpen = ref(false)
const editedRepayment = ref<GroupRepaymentDto>()
const prefilledTransfer = ref<GroupTransferDto>()
const addExpenseButton = ref<ComponentPublicInstance | null>(null)
const addExpenseIconButton = ref<ComponentPublicInstance | null>(null)
const recordRepaymentButton = ref<ComponentPublicInstance | null>(null)
const recordRepaymentIconButton = ref<ComponentPublicInstance | null>(null)

const shown = computed(() => (notFound.value || isError.value ? undefined : group.value))
const manageable = computed(() => shown.value !== undefined && canManage(scope.value))
const title = computed(() => shown.value?.name ?? t('groups.page.title'))
const access = computed(() => (group.value ? entryAccess(group.value) : undefined))
const canAddExpense = computed(() => access.value?.canAddExpense ?? false)
const canRecordRepayment = computed(() => access.value?.canRecordRepayment ?? false)
const hint = computed(() => (access.value?.hint ? t(`groups.hints.${access.value.hint}`) : undefined))
const addExpenseHint = computed(() => (canAddExpense.value ? undefined : HINT_ID))
const recordRepaymentHint = computed(() => (canRecordRepayment.value ? undefined : HINT_ID))

const openMembers = () => {
  membersOpen.value = true
}

const openShare = () => {
  shareOpen.value = true
}

const openSettings = () => {
  settingsOpen.value = true
}

const openNewExpense = () => {
  editedExpense.value = undefined
  expenseOpen.value = true
}

const openExpense = (expense: GroupExpenseDto) => {
  editedExpense.value = expense
  expenseOpen.value = true
}

function openRepayment(repayment?: GroupRepaymentDto, transfer?: GroupTransferDto) {
  editedRepayment.value = repayment
  prefilledTransfer.value = transfer
  repaymentOpen.value = true
}

const openNewRepayment = () => openRepayment()

function focusFirstVisible(...buttons: Ref<ComponentPublicInstance | null>[]) {
  const target = buttons
    .map((button) => button.value?.$el)
    .find((element): element is HTMLElement => element instanceof HTMLElement && element.checkVisibility())
  target?.focus()
}

const focusAddExpense = () => focusFirstVisible(addExpenseButton, addExpenseIconButton)

function focusRecordRepayment() {
  // The success toast autofocuses its close button while the dialog is closing, and that is not a place to leave the focus.
  const active = document.activeElement
  const kept =
    active instanceof HTMLElement && active !== document.body && active.isConnected && !active.closest('.p-toast')
  if (!kept) focusFirstVisible(recordRepaymentButton, recordRepaymentIconButton)
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
    <template v-if="shown" #actions>
      <Button
        ref="addExpenseButton"
        class="hidden! min-h-11 lg:inline-flex!"
        :disabled="!canAddExpense"
        :aria-describedby="addExpenseHint"
        @click="openNewExpense"
      >
        <AppIcon name="plus" :size="16" :stroke-width="2.2" />
        {{ t('groups.actions.addExpense') }}
      </Button>
      <Button
        ref="addExpenseIconButton"
        class="size-11 lg:hidden!"
        :aria-label="t('groups.actions.addExpense')"
        :disabled="!canAddExpense"
        :aria-describedby="addExpenseHint"
        @click="openNewExpense"
      >
        <AppIcon name="plus" :size="20" :stroke-width="2.2" />
      </Button>
      <Button
        ref="recordRepaymentButton"
        severity="secondary"
        outlined
        class="hidden! min-h-11 lg:inline-flex!"
        :disabled="!canRecordRepayment"
        :aria-describedby="recordRepaymentHint"
        @click="openNewRepayment"
      >
        <AppIcon name="transfer" :size="16" />
        {{ t('groups.actions.recordRepayment') }}
      </Button>
      <Button
        ref="recordRepaymentIconButton"
        severity="secondary"
        outlined
        class="size-11 lg:hidden!"
        :aria-label="t('groups.actions.recordRepayment')"
        :disabled="!canRecordRepayment"
        :aria-describedby="recordRepaymentHint"
        @click="openNewRepayment"
      >
        <AppIcon name="transfer" :size="20" />
      </Button>
      <template v-if="manageable">
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
        <Button severity="secondary" outlined class="hidden! min-h-11 lg:inline-flex!" @click="openShare">
          <AppIcon name="share" :size="16" />
          {{ t('groups.actions.share') }}
        </Button>
        <Button
          severity="secondary"
          outlined
          class="size-11 lg:hidden!"
          :aria-label="t('groups.actions.share')"
          @click="openShare"
        >
          <AppIcon name="share" :size="20" />
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
  <template v-else-if="group">
    <p v-if="hint" :id="HINT_ID" class="m-0 text-sm text-muted">{{ hint }}</p>
    <GroupSummaryCards :group="group" />
    <BalancesCard :group="group" @record="(transfer) => openRepayment(undefined, transfer)" />
    <ExpenseList :group="group" :can-add="canAddExpense" :hint-id="HINT_ID" @add="openNewExpense" @edit="openExpense" />
    <GroupRepaymentList
      :group="group"
      :can-record="canRecordRepayment"
      :hint-id="HINT_ID"
      @record="openNewRepayment"
      @edit="openRepayment"
    />
  </template>
  <div
    v-else-if="isPending"
    class="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4"
    aria-hidden="true"
  >
    <Skeleton v-for="index in 2" :key="index" height="6.5rem" border-radius="16px" />
  </div>
  <MembersDialog v-if="group" v-model:visible="membersOpen" :group="group" />
  <ShareDialog v-if="group" v-model:visible="shareOpen" :group="group" />
  <GroupDialog v-if="group" v-model:visible="settingsOpen" :group="group" @deleted="onDeleted" />
  <ExpenseDialog
    v-if="group"
    v-model:visible="expenseOpen"
    :group="group"
    :expense="editedExpense"
    @deleted="focusAddExpense"
  />
  <GroupRepaymentDialog
    v-if="group"
    v-model:visible="repaymentOpen"
    :group="group"
    :repayment="editedRepayment"
    :prefill="prefilledTransfer"
    @changed="focusRecordRepayment"
  />
</template>
