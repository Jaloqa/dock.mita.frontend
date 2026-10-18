import { safeRedirect } from '~/shared/auth/safeRedirect'

export function useAuthRedirect() {
  const route = useRoute()
  const localePath = useLocalePath()

  const redirect = computed(() => (typeof route.query.redirect === 'string' ? route.query.redirect : undefined))

  const linkTo = (name: 'login' | 'register') =>
    localePath({ name, query: redirect.value === undefined ? {} : { redirect: redirect.value } })

  const continueToApp = () => {
    const target = safeRedirect(redirect.value)
    return navigateTo(target === '/' ? localePath('index') : target, { replace: true })
  }

  return { linkTo, continueToApp }
}
