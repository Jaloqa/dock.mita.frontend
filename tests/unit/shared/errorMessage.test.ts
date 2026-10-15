import { describe, expect, it } from 'bun:test'
import { errorMessageKey } from '../../../app/shared/api/errorMessage'
import { ApiError } from '../../../app/shared/api/problem'

const apiError = (status: number) => new ApiError({ status, title: 'raw title' })

describe('errorMessageKey', () => {
  it('maps API errors by status', () => {
    expect(errorMessageKey(apiError(400))).toBe('shared.error.validation')
    expect(errorMessageKey(apiError(404))).toBe('shared.error.notFound')
    expect(errorMessageKey(apiError(500))).toBe('shared.error.server')
    expect(errorMessageKey(apiError(503))).toBe('shared.error.server')
    expect(errorMessageKey(apiError(409))).toBe('shared.error.unknown')
  })

  it('maps anything else to the generic message', () => {
    expect(errorMessageKey(new Error('boom'))).toBe('shared.error.unknown')
    expect(errorMessageKey(undefined)).toBe('shared.error.unknown')
  })
})
