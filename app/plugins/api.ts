import { createApiClient } from '~/shared/api/client'
import type { UserDto } from '~/shared/api/contract'
import { readCookie } from '~/shared/api/cookies'
import { sessionEvents } from '~/shared/api/sessionEvents'
import type { Transport } from '~/shared/api/transport'
import { createHttpTransport, type Fetcher } from '~/shared/api/transports/http'
import { loadMockTransport } from '~/shared/api/transports/mock'
import { createRoutingTransport, parseRealPaths } from '~/shared/api/transports/routing'
import { userKeys } from '~/shared/user/keys'

export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig()
  const locale = () => nuxtApp.$i18n.locale.value
  const request = import.meta.server ? useRequestFetch() : $fetch
  const fetcher: Fetcher = (url, options) =>
    request(url, { ...options, body: options.body as Record<string, unknown> | undefined })
  const requestCookies = import.meta.server ? useRequestHeaders(['cookie']).cookie : undefined
  const xsrfToken = () => readCookie(import.meta.server ? requestCookies : document.cookie, 'XSRF-TOKEN')
  const http = createHttpTransport(fetcher, {
    baseUrl: '',
    locale,
    xsrfToken,
    onSessionExpired: () => sessionEvents.emitExpired(),
    // The refresh cookie is scoped to /v1/auth, so page requests never carry it, and a rotation done on the server would never reach the browser.
    refresh: import.meta.client,
  })
  const mode = useApiMode()
  let transport: Transport = http
  if (mode === 'mock') {
    transport = await loadMockTransport()
  } else if (mode === 'hybrid') {
    const realPaths = parseRealPaths(config.public.apiRealPaths)
    const mock = await loadMockTransport({
      currentUserId: () => nuxtApp.$queryClient.getQueryData<UserDto>(userKeys.me)?.id,
    })
    transport = createRoutingTransport({ http, mock, realPaths })
  }

  return { provide: { api: createApiClient(transport) } }
})
