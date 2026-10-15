export type ColorModePreference = 'system' | 'light' | 'dark'

export function useColorMode() {
  const preference = useCookie<ColorModePreference>('mita-color-mode', {
    default: () => 'system',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  const systemPrefersDark = useState('mita-system-dark', () => false)

  const isDark = computed(() => (preference.value === 'system' ? systemPrefersDark.value : preference.value === 'dark'))

  return { preference, isDark, systemPrefersDark }
}
