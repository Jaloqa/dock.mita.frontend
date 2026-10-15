import { ApiError } from '../app/shared/api/problem'
import type { Transport } from '../app/shared/api/transport'
import type { MockApi } from './api'
import { MockHttpError } from './errors'

const realisticDelay = () => 150 + Math.random() * 250

export function createMockTransport(api: MockApi, delay: () => number = realisticDelay): Transport {
  return async (request) => {
    const wait = delay()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    try {
      return await api.handle(request)
    } catch (error) {
      if (error instanceof MockHttpError) throw new ApiError(error.problem)
      throw new ApiError({ status: 500, title: 'Server error' })
    }
  }
}
