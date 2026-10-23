import type { ApiRequest, Transport } from './transport'

export type RequestOptions = { headers?: Record<string, string> }

export type ApiClient = {
  get<T>(path: string, query?: ApiRequest['query'], options?: RequestOptions): Promise<T>
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>
  delete<T = void>(path: string, body?: unknown, options?: RequestOptions): Promise<T>
}

const withHeaders = (request: ApiRequest, options: RequestOptions | undefined): ApiRequest =>
  options?.headers && Object.keys(options.headers).length > 0 ? { ...request, headers: options.headers } : request

export function createApiClient(transport: Transport): ApiClient {
  return {
    get: <T>(path: string, query?: ApiRequest['query'], options?: RequestOptions) =>
      transport(withHeaders(query ? { method: 'GET', path, query } : { method: 'GET', path }, options)) as Promise<T>,
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      transport(withHeaders({ method: 'POST', path, body }, options)) as Promise<T>,
    put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      transport(withHeaders({ method: 'PUT', path, body }, options)) as Promise<T>,
    delete: <T = void>(path: string, body?: unknown, options?: RequestOptions) =>
      transport(
        withHeaders(body === undefined ? { method: 'DELETE', path } : { method: 'DELETE', path, body }, options),
      ) as Promise<T>,
  }
}
