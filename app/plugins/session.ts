import { sessionEvents } from '~/shared/api/sessionEvents'
import { isOpenRoute, isPublicRoute } from '~/shared/auth/publicRoutes'
import { useSessionStatus } from '~/shared/auth/sessionStatus'

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return

  const status = useSessionStatus()
  const router = useRouter()
  const localePath = useLocalePath(nuxtApp)
  const routeBaseName = useRouteBaseName(nuxtApp)

  sessionEvents.onExpired(() => {
    const wasAuthenticated = status.value === 'authenticated'
    status.value = 'anonymous'
    nuxtApp.$queryClient.clear()
    const current = router.currentRoute.value
    const name = routeBaseName(current)
    if (!wasAuthenticated || isPublicRoute(name) || isOpenRoute(name)) return
    void nuxtApp.runWithContext(() =>
      navigateTo(localePath({ name: 'login', query: { redirect: current.fullPath, expired: '1' } })),
    )
  })
})
