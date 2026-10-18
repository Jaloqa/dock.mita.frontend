import { resolveProxyUrl } from '../utils/apiProxy'

export default defineEventHandler((event) => {
  const url = resolveProxyUrl(useRuntimeConfig(event).apiProxyTarget, event.node.req.url ?? '')
  if (!url) return
  return proxyRequest(event, url)
})
