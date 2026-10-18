import { type ApiMode, resolveApiMode } from '~/shared/api/apiMode'

export const useApiMode = (): ApiMode => {
  const { apiMocks, apiRealPaths } = useRuntimeConfig().public
  return resolveApiMode(apiMocks, apiRealPaths)
}
