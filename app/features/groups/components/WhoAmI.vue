<script setup lang="ts">
import type { GroupMemberDto } from '~/shared/api/contract'

defineProps<{ groupName: string; members: GroupMemberDto[]; again?: boolean }>()
const emit = defineEmits<{ choose: [memberId: string] }>()
const { t } = useI18n()

const TITLE_ID = 'link-who-title'

const heading = ref<HTMLElement | null>(null)

onMounted(() => heading.value?.focus())
</script>

<template>
  <section
    :aria-labelledby="TITLE_ID"
    class="mx-auto flex w-full max-w-120 flex-col gap-4 rounded-(--radius-card) bg-surface p-6 sm:p-8"
  >
    <div class="flex flex-col gap-1">
      <p class="m-0 text-[13px] font-medium break-words text-muted">{{ groupName }}</p>
      <h1 :id="TITLE_ID" ref="heading" tabindex="-1" class="m-0 text-2xl font-bold tracking-tight outline-none">
        {{ t('groups.link.whoAreYou') }}
      </h1>
    </div>
    <p v-if="again" role="alert" class="m-0 rounded-(--radius-control) bg-track px-3 py-2 text-sm">
      {{ t('groups.link.again') }}
    </p>
    <p v-if="members.length === 0" class="m-0 text-sm text-muted">
      {{ t('groups.members.empty') }} {{ t('groups.link.askForMembers') }}
    </p>
    <template v-else>
      <p class="m-0 text-sm text-muted">{{ t('groups.link.pick') }}</p>
      <ul class="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        <li v-for="member in members" :key="member.id" class="min-w-0">
          <Button
            :label="member.name"
            severity="secondary"
            outlined
            class="min-h-11 w-full break-words"
            @click="emit('choose', member.id)"
          />
        </li>
      </ul>
    </template>
  </section>
</template>
