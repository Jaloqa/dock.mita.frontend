export type ApiMode = 'mock' | 'real'

export function resolveApiMode(apiMocks: boolean): ApiMode {
  return apiMocks ? 'mock' : 'real'
}
