export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export type QueryValue = string | number | boolean | undefined

export type ApiRequest = {
  method: HttpMethod
  path: string
  query?: Record<string, QueryValue>
  body?: unknown
}

export type Transport = (request: ApiRequest) => Promise<unknown>
