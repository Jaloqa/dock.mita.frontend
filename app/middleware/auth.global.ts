import { ApiError } from '~/shared/api/problem'
import { isPublicRoute } from '~/shared/auth/publicRoutes'
import { safeRedirect } from '~/shared/auth/safeRedirect'
import { type SessionStatus, useSessionStatus } from '~/shared/auth/sessionStatus'
import { userKeys } from '~/shared/user/keys'
import { meQueryOptions } from '~/shared/user/useCurrentUser'

const MAX_PROBE_RETRIES = 2

const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401

const retryUnlessUnauthorized = (failureCount: number, error: unknown) =>
  !isUnauthorized(error) && failureCount < MAX_PROBE_RETRIES

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  const config = useRuntimeConfig()
  const status = useSessionStatus()
  const router = useRouter()
  const localePath = useLocalePath()
  const routeBaseName = useRouteBaseName()
  const queryClient = nuxtApp.$queryClient
  const meQuery = meQueryOptions(nuxtApp.$api)

  const probe = async (retry: false | typeof retryUnlessUnauthorized, onFailure: SessionStatus) => {
    status.value = 'unknown'
    try {
      await queryClient.fetchQuery({ ...meQuery, retry })
      status.value = 'authenticated'
    } catch {
      status.value = onFailure
    }
  }

  if (import.meta.server) {
    const reachable = config.apiProxyTarget.trim() !== ''
    if (useApiMode() === 'real' && reachable && status.value === 'unknown') await probe(false, 'unknown')
  } else if (
    status.value !== 'anonymous' &&
    (status.value === 'unknown' || queryClient.getQueryData(userKeys.me) === undefined)
  ) {
    await probe(retryUnlessUnauthorized, 'anonymous')
  }

  const isPublic = isPublicRoute(routeBaseName(to))
  if (status.value === 'anonymous' && !isPublic) {
    return navigateTo(localePath({ name: 'login', query: { redirect: to.fullPath } }))
  }
  if (status.value === 'authenticated' && isPublic) {
    const target = safeRedirect(to.query.redirect)
    const leadsToPublicPage = isPublicRoute(routeBaseName(router.resolve(target)))
    return navigateTo(target === '/' || leadsToPublicPage ? localePath('index') : target)
  }
})
