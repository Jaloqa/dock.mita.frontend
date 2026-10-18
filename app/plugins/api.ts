import { createApiClient } from '~/shared/api/client'
import type { Transport } from '~/shared/api/transport'
import { createHttpTransport, type Fetcher } from '~/shared/api/transports/http'
import { loadMockTransport } from '~/shared/api/transports/mock'
import { createRoutingTransport, parseRealPaths } from '~/shared/api/transports/routing'

export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig()
  const locale = () => nuxtApp.$i18n.locale.value
  const fetcher: Fetcher = (url, options) =>
    $fetch(url, { ...options, body: options.body as Record<string, unknown> | undefined })
  const http = createHttpTransport(fetcher, { baseUrl: '', locale })
  const realPaths = parseRealPaths(config.public.apiRealPaths)
  let transport: Transport = http
  if (config.public.apiMocks) {
    const mock = await loadMockTransport()
    transport = realPaths.length > 0 ? createRoutingTransport({ http, mock, realPaths }) : mock
  }

  return { provide: { api: createApiClient(transport) } }
})
