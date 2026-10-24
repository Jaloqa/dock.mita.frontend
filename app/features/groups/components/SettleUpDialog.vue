<script setup lang="ts">
import type { GroupDto, OpenShareDto } from '~/shared/api/contract'
import { todayIso } from '~/shared/period/period'
import { categoryLabel, memberName } from '../utils/groupView'
import { isMemberRefusal } from '../utils/scope'

const props = defineProps<{ group: GroupDto }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ settled: [] }>()
const { t } = useI18n()
const { format } = useMoney()
const notify = useNotify()
const server = useServerErrors()
const { create, refresh } = useGroupRepaymentMutations()
const { shares } = useOpenShares(useGroupScope(), () => props.group.myMemberId !== null)

const selected = ref<string[]>([])
const available = computed(() => new Set(shares.value.map((share) => share.expenseId)))
const chosen = computed(() => selected.value.filter((id) => available.value.has(id)))

type Payer = { id: string; name: string; shares: OpenShareDto[] }

const payers = computed<Payer[]>(() => {
  const byPayer = new Map<string, OpenShareDto[]>()
  for (const share of shares.value) byPayer.set(share.payerId, [...(byPayer.get(share.payerId) ?? []), share])
  return [...byPayer].map(([id, own]) => ({ id, name: memberName(props.group, id), shares: own }))
})

const shareTitle = (share: OpenShareDto) => share.description ?? categoryLabel(t, props.group, share.categoryId)
const chosenOf = (payer: Payer) => payer.shares.filter((share) => chosen.value.includes(share.expenseId))
const totalOf = (payer: Payer) => chosenOf(payer).reduce((sum, share) => sum + share.open, 0)
const inputId = (share: OpenShareDto) => `settle-up-${share.expenseId}`
const saving = computed(() => create.isPending.value)
const empty = computed(() => payers.value.length === 0)
const settled = ref(false)

watch(visible, (open) => {
  if (!open) return
  selected.value = []
  settled.value = false
  server.clear()
})

function onAfterHide() {
  if (!settled.value) return
  settled.value = false
  emit('settled')
}

async function pay() {
  const memberId = props.group.myMemberId
  if (memberId === null || saving.value) return
  server.clear()
  const date = todayIso()
  let paid = 0
  try {
    for (const payer of payers.value) {
      const own = chosenOf(payer)
      if (own.length === 0) continue
      await create.mutateAsync({
        fromMemberId: memberId,
        toMemberId: payer.id,
        amount: totalOf(payer),
        currency: props.group.currency,
        date,
        settles: own.map((share) => share.expenseId),
      })
      paid += 1
    }
  } catch (error) {
    if (paid > 0) {
      settled.value = true
      notify.success(t('groups.settle.toast.paid', { count: paid }, paid))
    }
    if (isMemberRefusal(error)) return
    if (!server.apply(error, ['settles'])) notify.error(error)
    await refresh()
    return
  }
  settled.value = true
  notify.success(t('groups.settle.toast.paid', { count: paid }, paid))
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('groups.settle.title')"
    class="w-[calc(100vw-2rem)] max-w-[30rem]"
    @after-hide="onAfterHide"
  >
    <p v-if="empty" class="m-0 text-sm text-muted">{{ t('groups.settle.empty') }}</p>
    <form v-else id="settle-up-form" class="flex flex-col gap-5" @submit.prevent="pay">
      <fieldset v-for="payer in payers" :key="payer.id" class="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
        <legend class="mb-1 flex w-full items-baseline justify-between gap-3 p-0 text-[13px] font-medium text-muted">
          <span>{{ t('groups.settle.owe', { name: payer.name }) }}</span>
          <span class="font-mono whitespace-nowrap">{{
            t('groups.settle.total', { amount: format(totalOf(payer), group.currency) })
          }}</span>
        </legend>
        <div v-for="share in payer.shares" :key="share.expenseId" class="flex min-h-11 items-center gap-3">
          <Checkbox v-model="selected" :value="share.expenseId" :input-id="inputId(share)" />
          <label
            :for="inputId(share)"
            class="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 text-sm"
          >
            <span class="min-w-0 break-words">{{ shareTitle(share) }}</span>
            <span class="font-mono whitespace-nowrap text-muted">{{ format(share.open, group.currency) }}</span>
          </label>
        </div>
      </fieldset>
      <p
        v-for="message in server.messages('settles')"
        :key="message"
        role="alert"
        class="m-0 text-xs font-medium text-accent"
      >
        {{ message }}
      </p>
    </form>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <Button
          :label="t('shared.actions.cancel')"
          severity="secondary"
          outlined
          class="min-h-11"
          @click="visible = false"
        />
        <Button
          v-if="!empty"
          type="submit"
          form="settle-up-form"
          :label="t('groups.settle.pay')"
          class="min-h-11"
          :loading="saving"
          :disabled="saving || chosen.length === 0"
        />
      </div>
    </template>
  </Dialog>
</template>
