export type ProblemDetails = {
  type?: string
  title: string
  status: number
  detail?: string
  errors?: Record<string, string[]>
}

const camelCase = (field: string): string => field.charAt(0).toLowerCase() + field.slice(1)

export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly fieldErrors: Record<string, string[]>

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title)
    this.name = 'ApiError'
    this.status = problem.status
    this.title = problem.title
    this.fieldErrors = Object.fromEntries(
      Object.entries(problem.errors ?? {}).map(([field, messages]) => [camelCase(field), messages]),
    )
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError

const isProblemDetails = (value: unknown): value is ProblemDetails =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { status?: unknown }).status === 'number' &&
  typeof (value as { title?: unknown }).title === 'string'

export function toApiError(status: number, body: unknown): ApiError {
  if (isProblemDetails(body)) return new ApiError(body)
  return new ApiError({ status, title: status >= 500 ? 'Server error' : 'Request failed' })
}

export const fieldErrorsOf = (error: unknown, field: string): string[] =>
  isApiError(error) ? (error.fieldErrors[field] ?? []) : []
