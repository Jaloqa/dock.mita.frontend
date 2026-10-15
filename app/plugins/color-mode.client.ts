export default defineNuxtPlugin(() => {
  const { systemPrefersDark } = useColorMode()
  const query = window.matchMedia('(prefers-color-scheme: dark)')

  systemPrefersDark.value = query.matches
  query.addEventListener('change', (event) => {
    systemPrefersDark.value = event.matches
  })
})
