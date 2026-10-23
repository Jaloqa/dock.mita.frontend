<script setup lang="ts">
import type { GroupDto } from '~/shared/api/contract'

const props = defineProps<{ group: GroupDto }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const localePath = useLocalePath()
const notify = useNotify()
const confirm = useConfirm()
const { share, unshare, refresh, isMissing } = useGroupMutations()

const LINK_ID = 'group-share-link'

const root = ref<HTMLElement | null>(null)

const link = computed(() => {
  const token = props.group.shareToken
  return token ? `${window.location.origin}${localePath(`/g/${token}`)}` : undefined
})
const busy = computed(() => share.isPending.value || unshare.isPending.value)

const find = <T extends HTMLElement>(selector: string) => root.value?.querySelector<T>(selector)

async function focusLink() {
  await nextTick()
  find(`#${LINK_ID}`)?.focus()
}

async function focusCreate() {
  await nextTick()
  find('[data-share-create]')?.focus()
}

function selectLink(event: FocusEvent) {
  if (event.target instanceof HTMLInputElement) event.target.select()
}

function fail(error: unknown) {
  notify.error(error)
  if (isMissing(error)) refresh()
}

function makeLink(message: string) {
  share.mutate(props.group.id, {
    onSuccess: () => {
      notify.success(message)
      focusLink()
    },
    onError: fail,
  })
}

function turnOff() {
  unshare.mutate(props.group.id, {
    onSuccess: () => {
      notify.success(t('groups.share.toast.turnedOff'))
      focusCreate()
    },
    onError: fail,
  })
}

function ask(header: string, message: string, acceptLabel: string, accept: () => void) {
  confirm.require({
    header,
    message,
    acceptLabel,
    rejectLabel: t('shared.actions.cancel'),
    acceptProps: { severity: 'danger' },
    rejectProps: { severity: 'secondary', outlined: true },
    accept,
  })
}

const create = () => makeLink(t('groups.share.toast.created'))

const confirmReplace = () =>
  ask(t('groups.share.confirm.replaceTitle'), t('groups.share.confirm.replaceMessage'), t('groups.share.replace'), () =>
    makeLink(t('groups.share.toast.replaced')),
  )

const confirmTurnOff = () =>
  ask(
    t('groups.share.confirm.turnOffTitle'),
    t('groups.share.confirm.turnOffMessage'),
    t('groups.share.turnOff'),
    turnOff,
  )

async function copy() {
  if (!link.value) return
  try {
    await navigator.clipboard.writeText(link.value)
    notify.success(t('groups.share.toast.copied'))
  } catch {
    notify.failure(t('groups.share.toast.copyFailed'))
    await focusLink()
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="t('groups.share.title')" class="w-[calc(100vw-2rem)] max-w-[32rem]">
    <div ref="root" class="flex flex-col gap-4">
      <template v-if="link">
        <FormRow :id="LINK_ID" :label="t('groups.share.link')">
          <template #default>
            <InputText :id="LINK_ID" :model-value="link" readonly fluid class="min-h-11" @focus="selectLink" />
          </template>
        </FormRow>
        <div class="flex flex-wrap items-center gap-2">
          <Button :label="t('groups.share.copy')" class="min-h-11" :disabled="busy" @click="copy" />
          <Button
            :label="t('groups.share.replace')"
            severity="secondary"
            outlined
            class="min-h-11"
            :disabled="busy"
            @click="confirmReplace"
          />
          <Button
            :label="t('groups.share.turnOff')"
            severity="danger"
            text
            class="min-h-11"
            :disabled="busy"
            @click="confirmTurnOff"
          />
        </div>
      </template>
      <template v-else>
        <p class="m-0 text-sm text-muted">{{ t('groups.share.off') }}</p>
        <Button
          data-share-create
          :label="t('groups.share.create')"
          class="min-h-11 self-start"
          :loading="share.isPending.value"
          :disabled="busy"
          @click="create"
        />
      </template>
    </div>
  </Dialog>
</template>
