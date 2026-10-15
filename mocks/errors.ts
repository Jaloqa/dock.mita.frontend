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

export const badRequest = (errors: Record<string, string[]>): never => {
  throw new MockHttpError({ status: 400, title: 'Validation failed', errors })
}
