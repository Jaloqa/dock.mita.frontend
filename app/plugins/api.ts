import { createApiClient } from '~/shared/api/client'
import type { Transport } from '~/shared/api/transport'
import { createHttpTransport, type Fetcher } from '~/shared/api/transports/http'
import { loadMockTransport } from '~/shared/api/transports/mock'

export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig()
  const locale = () => nuxtApp.$i18n.locale.value
  const fetcher: Fetcher = (url, options) =>
    $fetch(url, { ...options, body: options.body as Record<string, unknown> | undefined })
  const transport: Transport = config.public.apiMocks
    ? await loadMockTransport()
    : createHttpTransport(fetcher, { baseUrl: config.public.apiBaseUrl, locale })

  return { provide: { api: createApiClient(transport) } }
})
