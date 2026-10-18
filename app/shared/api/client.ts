import type { ApiRequest, Transport } from './transport'

export type ApiClient = {
  get<T>(path: string, query?: ApiRequest['query']): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  put<T>(path: string, body?: unknown): Promise<T>
  delete<T = void>(path: string, body?: unknown): Promise<T>
}

export function createApiClient(transport: Transport): ApiClient {
  return {
    get: <T>(path: string, query?: ApiRequest['query']) =>
      transport(query ? { method: 'GET', path, query } : { method: 'GET', path }) as Promise<T>,
    post: <T>(path: string, body?: unknown) => transport({ method: 'POST', path, body }) as Promise<T>,
    put: <T>(path: string, body?: unknown) => transport({ method: 'PUT', path, body }) as Promise<T>,
    delete: <T = void>(path: string, body?: unknown) =>
      transport(body === undefined ? { method: 'DELETE', path } : { method: 'DELETE', path, body }) as Promise<T>,
  }
}
