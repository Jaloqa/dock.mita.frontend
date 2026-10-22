import type { ProblemDetails } from '../app/shared/api/problem'

export class MockHttpError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title)
    this.name = 'MockHttpError'
  }
}

export const notFound = (): never => {
  throw new MockHttpError({ status: 404, title: 'Not Found' })
}

export const unauthorized = (code: string): never => {
  throw new MockHttpError({ status: 401, title: 'Unauthorized', code })
}

export const ratesUnavailable = (): never => {
  throw new MockHttpError({ status: 503, title: 'Service Unavailable', code: 'rates.unavailable' })
}

export const badRequest = (errors: Record<string, string[]>): never => {
  throw new MockHttpError({ status: 400, title: 'Validation failed', errors })
}
