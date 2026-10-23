import type { InjectionKey } from 'vue'

const newDebtFocusKey: InjectionKey<() => void> = Symbol('newDebtFocus')

export function provideNewDebtFocus(focus: () => void): void {
  provide(newDebtFocusKey, focus)
}

export function useNewDebtFocus(): () => void {
  return inject(newDebtFocusKey, () => undefined)
}
