<script setup lang="ts">
import { entryAccess } from '~/features/groups/utils/groupView'
import { isShareToken, linkQueryEnabled, linkScope } from '~/features/groups/utils/scope'
import type { GroupExpenseDto, GroupRepaymentDto, GroupTransferDto } from '~/shared/api/contract'

definePageMeta({ layout: 'link' })

const HINT_ID = 'group-entry-hint'

const { t } = useI18n()
const confirm = useConfirm()
const route = useRoute()
const token = computed(() => String(route.params.token))
const wellFormed = computed(() => isShareToken(token.value))
const { memberId, choose, forget } = useLinkMember(token)
const scope = computed(() => linkScope(token.value, memberId.value))
const mounted = ref(false)
const { group, isError, notFound, refetch } = useGroup(scope, {
  enabled: () => linkQueryEnabled(token.value, mounted.value),
})

const again = ref(false)
const expenseOpen = ref(false)
const editedExpense = ref<GroupExpenseDto>()
const repaymentOpen = ref(false)
const editedRepayment = ref<GroupRepaymentDto>()
const prefilledTransfer = ref<GroupTransferDto>()
const linkBar = ref<{ focus: () => void } | null>(null)
const entryActions = ref<{ focusAddExpense: () => void; focusRecordRepayment: () => void } | null>(null)

const dead = computed(() => !wellFormed.value || notFound.value)
const member = computed(() => group.value?.members.find((item) => item.id === memberId.value))
const access = computed(() => (group.value ? entryAccess(group.value) : undefined))
const canAddExpense = computed(() => access.value?.canAddExpense ?? false)
const canRecordRepayment = computed(() => access.value?.canRecordRepayment ?? false)
const hint = computed(() => (access.value?.hint === 'oneMember' ? t('groups.link.oneMember') : undefined))

function closeDialogs() {
  expenseOpen.value = false
  editedExpense.value = undefined
  repaymentOpen.value = false
  editedRepayment.value = undefined
  prefilledTransfer.value = undefined
  confirm.close()
}

function askAgain() {
  closeDialogs()
  forget()
  again.value = true
}

provideGroupScope(scope, () => {
  askAgain()
  refetch()
})

watch([() => group.value?.members, memberId], ([members, id]) => {
  if (members && id !== null && !members.some((item) => item.id === id)) askAgain()
})

onMounted(() => {
  mounted.value = true
})

async function onChoose(id: string) {
  again.value = false
  choose(id)
  await nextTick()
  linkBar.value?.focus()
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

const focusAddExpense = () => entryActions.value?.focusAddExpense()

const focusRecordRepayment = () => entryActions.value?.focusRecordRepayment()

useHead({
  title: () => (dead.value ? undefined : group.value?.name),
  meta: [
    { name: 'referrer', content: 'no-referrer' },
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <section v-if="dead" class="mx-auto flex w-full max-w-120 flex-col rounded-(--radius-card) bg-surface p-6 sm:p-8">
    <h1 class="m-0 text-lg font-semibold">{{ t('groups.link.dead') }}</h1>
  </section>
  <div v-else-if="!mounted || (!group && !isError)" class="flex flex-col gap-4" aria-hidden="true">
    <Skeleton height="3.25rem" border-radius="16px" />
    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4">
      <Skeleton v-for="index in 2" :key="index" height="6.5rem" border-radius="16px" />
    </div>
  </div>
  <ErrorState v-else-if="isError || !group" @retry="refetch" />
  <WhoAmI v-else-if="!member" :group-name="group.name" :members="group.members" :again="again" @choose="onChoose" />
  <template v-else>
    <LinkBar ref="linkBar" :name="member.name" @change="forget" />
    <PageHeader :title="group.name">
      <template #actions>
        <GroupEntryActions
          ref="entryActions"
          :can-add-expense="canAddExpense"
          :can-record-repayment="canRecordRepayment"
          :hint-id="HINT_ID"
          @add-expense="openNewExpense"
          @record-repayment="openNewRepayment"
        />
      </template>
    </PageHeader>
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
    <ExpenseDialog v-model:visible="expenseOpen" :group="group" :expense="editedExpense" @deleted="focusAddExpense" />
    <GroupRepaymentDialog
      v-model:visible="repaymentOpen"
      :group="group"
      :repayment="editedRepayment"
      :prefill="prefilledTransfer"
      @changed="focusRecordRepayment"
    />
  </template>
</template>
