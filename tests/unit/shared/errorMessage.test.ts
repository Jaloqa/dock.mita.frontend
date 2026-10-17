import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { errorMessageKey } from '../../../app/shared/api/errorMessage'
import { ApiError } from '../../../app/shared/api/problem'
import en from '../../../i18n/locales/en.json'

const apiError = (status: number) => new ApiError({ status, title: 'raw title' })

describe('errorMessageKey', () => {
  it('maps API errors by status', () => {
    expect(errorMessageKey(apiError(400))).toBe('shared.error.validation')
    expect(errorMessageKey(apiError(404))).toBe('shared.error.notFound')
    expect(errorMessageKey(apiError(500))).toBe('shared.error.server')
    expect(errorMessageKey(apiError(503))).toBe('shared.error.server')
    expect(errorMessageKey(apiError(409))).toBe('shared.error.unknown')
  })

  it('shows the first validation code of a bad request', () => {
    const error = new ApiError({
      status: 400,
      title: 'raw title',
      errors: { Period: ['validation.nothingToCopy'], amount: ['validation.positiveAmount'] },
    })
    expect(errorMessageKey(error)).toBe('validation.nothingToCopy')
  })

  it('ignores field messages that are not validation codes', () => {
    const error = new ApiError({ status: 400, title: 'raw title', errors: { name: ['Name is required'] } })
    expect(errorMessageKey(error)).toBe('shared.error.validation')
  })

  it('has a message for every validation code the API returns', () => {
    const mocks = new Bun.Glob('mocks/**/*.ts')
    const codes = new Set<string>()
    for (const file of mocks.scanSync('.')) {
      for (const match of readFileSync(file, 'utf8').matchAll(/'(validation\.[A-Za-z0-9]+)'/g)) {
        if (match[1]) codes.add(match[1])
      }
    }
    expect(codes.size).toBeGreaterThan(10)
    const known = Object.keys(en.validation).map((key) => `validation.${key}`)
    expect(known).toEqual(expect.arrayContaining([...codes]))
  })

  it('maps anything else to the generic message', () => {
    expect(errorMessageKey(new Error('boom'))).toBe('shared.error.unknown')
    expect(errorMessageKey(undefined)).toBe('shared.error.unknown')
  })
})
