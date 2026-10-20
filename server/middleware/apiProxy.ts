import { forwardedHeaders, isApiPath, resolveProxyUrl } from '../utils/apiProxy'

export default defineEventHandler((event) => {
  const requestUrl = event.node.req.url ?? ''
  if (!isApiPath(requestUrl)) return
  const target = useRuntimeConfig(event).apiProxyTarget
  if (!target.trim()) {
    setResponseHeader(event, 'content-type', 'application/problem+json')
    setResponseStatus(event, 503)
    return { type: 'about:blank', title: 'API proxy target is not configured', status: 503 }
  }
  const url = resolveProxyUrl(target, requestUrl)
  if (!url) return
  return proxyRequest(event, url, {
    headers: forwardedHeaders(
      {
        forwardedFor: getRequestHeader(event, 'x-forwarded-for'),
        forwardedProto: getRequestHeader(event, 'x-forwarded-proto'),
      },
      {
        ip: event.node.req.socket?.remoteAddress,
        protocol: getRequestProtocol(event, { xForwardedProto: false }) as 'http' | 'https',
      },
    ),
  })
})
