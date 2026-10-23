import { type ComputedRef, computed, type InjectionKey, inject, type MaybeRefOrGetter, provide, toValue } from 'vue'
import type { GroupScope } from '../utils/scope'

const groupScopeKey: InjectionKey<ComputedRef<GroupScope>> = Symbol('groupScope')

export function provideGroupScope(scope: MaybeRefOrGetter<GroupScope>): void {
  provide(
    groupScopeKey,
    computed(() => toValue(scope)),
  )
}

export function useGroupScope(): ComputedRef<GroupScope> {
  const scope = inject(groupScopeKey, undefined)
  if (!scope) throw new Error('useGroupScope() needs provideGroupScope() in a parent component')
  return scope
}
