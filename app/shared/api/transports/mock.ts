import { ApiError } from '../problem'
import type { Transport } from '../transport'

export async function loadMockTransport(): Promise<Transport> {
  if (import.meta.server) {
    return async () => {
      throw new ApiError({ status: 503, title: 'Mock backend runs in the browser only' })
    }
  }
  const [{ createMockApi }, { createMockTransport }, { defaultHandlers }] = await Promise.all([
    import('~~/mocks/api'),
    import('~~/mocks/transport'),
    import('~~/mocks/handlers'),
  ])
  return createMockTransport(createMockApi({ storage: window.localStorage, register: defaultHandlers }))
}
