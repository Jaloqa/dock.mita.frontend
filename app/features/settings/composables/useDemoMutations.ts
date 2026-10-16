import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { DemoStateDto } from '~/shared/api/contract'
import { settingsKeys } from '../api/keys'
import { settingsApi } from '../api/settingsApi'

export function useDemoMutations() {
  const api = settingsApi(useApi())
  const queryClient = useQueryClient()
  const store = (state: DemoStateDto) => queryClient.setQueryData(settingsKeys.demo, state)
  const replaceEverything = (state: DemoStateDto) => {
    store(state)
    queryClient.resetQueries({ predicate: (query) => query.queryKey[0] !== settingsKeys.demo[0] })
  }

  return {
    switchUser: useMutation({ mutationFn: api.switchUser, onSuccess: replaceEverything }),
    reset: useMutation({ mutationFn: api.resetDemo, onSuccess: replaceEverything }),
    simulateErrors: useMutation({ mutationFn: api.simulateErrors, onSuccess: store }),
  }
}
