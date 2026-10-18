<script setup lang="ts">
import { isPublicRoute } from '~/shared/auth/publicRoutes'
import { useSessionStatus } from '~/shared/auth/sessionStatus'

const status = useSessionStatus()
const route = useRoute()
const routeBaseName = useRouteBaseName()
const waiting = computed(() => status.value === 'unknown' && !isPublicRoute(routeBaseName(route)))
// The client middleware settles the session before hydration; keeping the server's decision until mount avoids a hydration mismatch.
const pending = useState('session-pending', () => waiting.value)

onMounted(() => {
  watch(
    waiting,
    (value) => {
      pending.value = value
    },
    { immediate: true },
  )
})
</script>

<template>
  <SessionSkeleton v-if="pending" />
  <slot v-else />
</template>
