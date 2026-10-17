import { ApiError } from '../problem'
import type { Transport } from '../transport'

export async function loadMockTransport(): Promise<Transport> {
  if (import.meta.server) {
    return async () => {
      throw new ApiError({ status: 503, title: 'Mock backend runs in the browser only' })
    }
  }
  const [{ createMockApi }, { createMockTransport }, { defaultHandlers }, { STORAGE_KEY }] = await Promise.all([
    import('~~/mocks/api'),
    import('~~/mocks/transport'),
    import('~~/mocks/handlers'),
    import('~~/mocks/db'),
  ])
  const api = createMockApi({ storage: window.localStorage, register: defaultHandlers })
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) api.db.reload()
  })
  return createMockTransport(api)
}
