const PUBLIC_ROUTE_NAMES: ReadonlySet<string> = new Set(['login', 'register'])

const OPEN_ROUTE_NAMES: ReadonlySet<string> = new Set(['g-token'])

export const isPublicRoute = (routeBaseName: string | symbol | undefined): boolean =>
  typeof routeBaseName === 'string' && PUBLIC_ROUTE_NAMES.has(routeBaseName)

export const isOpenRoute = (routeBaseName: string | symbol | undefined): boolean =>
  typeof routeBaseName === 'string' && OPEN_ROUTE_NAMES.has(routeBaseName)
