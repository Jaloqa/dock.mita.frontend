const PUBLIC_ROUTE_NAMES: ReadonlySet<string> = new Set(['login', 'register'])

export const isPublicRoute = (routeBaseName: string | symbol | undefined): boolean =>
  typeof routeBaseName === 'string' && PUBLIC_ROUTE_NAMES.has(routeBaseName)
