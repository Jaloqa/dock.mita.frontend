import type { ApiRequest } from '../app/shared/api/transport'
import { createDb, type KeyValueStorage, type MockDb } from './db'
import { MockHttpError, notFound, unauthorized } from './errors'
import { createRouter, type MockRouter } from './router'
import { seedState } from './seed'
import { cloneUserData } from './seed/cloneUser'

const DEMO_SOURCE_USER = 'usr_anna'

export type MockApi = { db: MockDb; handle(request: ApiRequest): Promise<unknown> }

const SIMULATED_ERROR_RATE = 0.2

const overTheWire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const stringQuery = (query: ApiRequest['query']): Record<string, string> =>
  Object.fromEntries(
    Object.entries(query ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  )

export function createMockApi(options: {
  storage?: KeyValueStorage
  random?: () => number
  register?: ((router: MockRouter) => void)[]
  currentUserId?: () => string | undefined
}): MockApi {
  const db = createDb(options.storage, seedState)
  const router = createRouter()
  const random = options.random ?? Math.random
  for (const register of options.register ?? []) register(router)

  return {
    db,
    handle: async (request) => {
      const isDemo = request.path.startsWith('/v1/demo/')
      // A failed session probe signs the user out, which would turn the error demo into a logout demo.
      const isSession = request.path.startsWith('/v1/auth/') || (request.method === 'GET' && request.path === '/v1/me')
      if (db.state.simulateErrors && !isDemo && !isSession && random() < SIMULATED_ERROR_RATE) {
        throw new MockHttpError({ status: 500, title: 'Simulated server error' })
      }
      const match = router.match(request.method, request.path) ?? notFound()
      const sessionUserId = options.currentUserId ? options.currentUserId() : (db.state.activeUserId ?? undefined)
      const open = isDemo || request.path.startsWith('/v1/auth/')
      if (sessionUserId === undefined && !open) unauthorized('auth.sessionExpired')
      if (
        options.currentUserId &&
        sessionUserId !== undefined &&
        cloneUserData(db.state, DEMO_SOURCE_USER, sessionUserId)
      ) {
        db.save()
      }
      const result = match.handler({
        db,
        userId: sessionUserId ?? '',
        params: match.params,
        query: stringQuery(request.query),
        body: request.body === undefined ? undefined : overTheWire(request.body),
      })
      return result === undefined ? undefined : overTheWire(result)
    },
  }
}
