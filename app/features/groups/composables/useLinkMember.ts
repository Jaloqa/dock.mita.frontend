import type { MaybeRefOrGetter, Ref } from 'vue'

const storageKey = (token: string) => `mita.groupMember.${token}`

function readMember(token: string): string | null {
  try {
    return globalThis.localStorage.getItem(storageKey(token))
  } catch {
    return null
  }
}

function writeMember(token: string, memberId: string | null): void {
  try {
    if (memberId === null) globalThis.localStorage.removeItem(storageKey(token))
    else globalThis.localStorage.setItem(storageKey(token), memberId)
  } catch {
    return
  }
}

export function useLinkMember(token: MaybeRefOrGetter<string>): {
  memberId: Readonly<Ref<string | null>>
  choose: (id: string) => void
  forget: () => void
} {
  const memberId = ref<string | null>(null)
  const read = () => {
    memberId.value = readMember(toValue(token))
  }
  const remember = (id: string | null) => {
    memberId.value = id
    writeMember(toValue(token), id)
  }

  onMounted(read)
  watch(() => toValue(token), read)

  return {
    memberId: readonly(memberId),
    choose: (id) => remember(id),
    forget: () => remember(null),
  }
}
