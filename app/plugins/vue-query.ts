import { type DehydratedState, dehydrate, hydrate, QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxtApp) => {
  const state = useState<DehydratedState | null>('vue-query', () => null)
  const mocksOnServer = import.meta.server && useRuntimeConfig().public.apiMocks
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false, enabled: !mocksOnServer },
    },
  })

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })

  if (import.meta.server && !useRuntimeConfig().public.apiMocks) {
    nuxtApp.hooks.hook('app:rendered', () => {
      state.value = dehydrate(queryClient)
    })
  }

  if (import.meta.client && state.value) {
    hydrate(queryClient, state.value)
  }

  return { provide: { queryClient } }
})
