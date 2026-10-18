import { sessionEvents } from '~/shared/api/sessionEvents'
import { isPublicRoute } from '~/shared/auth/publicRoutes'
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
    if (!wasAuthenticated || isPublicRoute(routeBaseName(current))) return
    void nuxtApp.runWithContext(() =>
      navigateTo(localePath({ name: 'login', query: { redirect: current.fullPath, expired: '1' } })),
    )
  })
})
