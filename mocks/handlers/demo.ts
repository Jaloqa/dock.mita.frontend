import type { DemoStateDto } from '../../app/shared/api/contract'
import type { MockDb } from '../db'
import { badRequest } from '../errors'
import type { MockRouter } from '../router'

const demoState = (db: MockDb): DemoStateDto => ({
  activeUserId: db.state.activeUserId,
  users: db.state.users.map(({ id, name }) => ({ id, name })),
  simulateErrors: db.state.simulateErrors,
})

const field = (body: unknown, name: string): unknown =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[name] : undefined

export function registerDemoHandlers(router: MockRouter) {
  router.on('GET', '/v1/demo/state', ({ db }) => demoState(db))

  router.on('POST', '/v1/demo/reset', ({ db }) => {
    const previous = db.state.activeUserId
    db.reset()
    if (previous !== null && db.state.users.some((user) => user.id === previous)) {
      db.state.activeUserId = previous
      db.save()
    }
    return demoState(db)
  })

  router.on('POST', '/v1/demo/switch-user', ({ db, body }) => {
    const userId = field(body, 'userId')
    if (typeof userId !== 'string' || !db.state.users.some((user) => user.id === userId)) {
      badRequest({ userId: ['validation.invalidValue'] })
    }
    db.state.activeUserId = userId as string
    db.save()
    return demoState(db)
  })

  router.on('PUT', '/v1/demo/simulate-errors', ({ db, body }) => {
    const enabled = field(body, 'enabled')
    if (typeof enabled !== 'boolean') badRequest({ enabled: ['validation.invalidValue'] })
    db.state.simulateErrors = enabled as boolean
    db.save()
    return demoState(db)
  })
}
