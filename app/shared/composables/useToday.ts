import { onScopeDispose, type Ref, readonly, ref } from 'vue'
import { todayIso } from '~/shared/period/period'

const msUntilTomorrow = (now: Date): number =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()

export function useToday(): Readonly<Ref<string>> {
  const today = ref(todayIso())
  if (typeof window === 'undefined') return readonly(today)

  let timer: ReturnType<typeof setTimeout> | undefined
  const refresh = () => {
    today.value = todayIso()
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      refresh()
      schedule()
    }, msUntilTomorrow(new Date()) + 1000)
  }
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    refresh()
    schedule()
  }

  schedule()
  document.addEventListener('visibilitychange', onVisible)
  onScopeDispose(() => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })
  return readonly(today)
}
