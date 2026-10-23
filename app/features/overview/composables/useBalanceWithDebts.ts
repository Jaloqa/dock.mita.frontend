import type { Ref } from 'vue'

const STORAGE_KEY = 'mita.balanceWithDebts'

function readPreference(): boolean {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writePreference(value: boolean): void {
  try {
    if (value) globalThis.localStorage.setItem(STORAGE_KEY, '1')
    else globalThis.localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

export function useBalanceWithDebts(): { included: Readonly<Ref<boolean>>; setIncluded: (value: boolean) => void } {
  const included = useState('balance-with-debts', () => false)
  const loaded = useState('balance-with-debts-loaded', () => false)

  onMounted(() => {
    if (loaded.value) return
    included.value = readPreference()
    loaded.value = true
  })

  return {
    included: readonly(included),
    setIncluded: (value) => {
      included.value = value
      loaded.value = true
      writePreference(value)
    },
  }
}
