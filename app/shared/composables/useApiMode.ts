import { type ApiMode, resolveApiMode } from '~/shared/api/apiMode'

export const useApiMode = (): ApiMode => resolveApiMode(useRuntimeConfig().public.apiMocks)
