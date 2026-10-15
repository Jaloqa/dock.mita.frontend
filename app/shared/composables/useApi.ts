import type { ApiClient } from '~/shared/api/client'

export const useApi = (): ApiClient => useNuxtApp().$api
