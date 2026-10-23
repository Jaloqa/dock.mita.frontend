import { type ComputedRef, computed, type InjectionKey, inject, type MaybeRefOrGetter, provide, toValue } from 'vue'
import { type GroupScope, isMemberRefusal } from '../utils/scope'

const groupScopeKey: InjectionKey<ComputedRef<GroupScope>> = Symbol('groupScope')

const memberRefusedKey: InjectionKey<() => void> = Symbol('memberRefused')

export function provideGroupScope(scope: MaybeRefOrGetter<GroupScope>, onMemberRefused?: () => void): void {
  provide(
    groupScopeKey,
    computed(() => toValue(scope)),
  )
  if (onMemberRefused) provide(memberRefusedKey, onMemberRefused)
}

export function useGroupScope(): ComputedRef<GroupScope> {
  const scope = inject(groupScopeKey, undefined)
  if (!scope) throw new Error('useGroupScope() needs provideGroupScope() in a parent component')
  return scope
}

export function useMemberRefusal(): (error: unknown) => void {
  const onMemberRefused = inject(memberRefusedKey, undefined)
  return (error) => {
    if (isMemberRefusal(error)) onMemberRefused?.()
  }
}
