import { isOverviewRange, type OverviewDto } from '../../app/shared/api/contract'
import { todayIso } from '../../app/shared/period/period'
import { badRequest } from '../errors'
import { overviewOf } from '../overview'
import type { MockRouter } from '../router'

export function registerOverviewHandlers(router: MockRouter) {
  router.on('GET', '/v1/overview', ({ db, userId, query }): OverviewDto => {
    const { period } = query
    if (period !== undefined && !isOverviewRange(period)) badRequest({ period: ['validation.invalidValue'] })
    return overviewOf(db, userId, isOverviewRange(period) ? period : 'month', todayIso())
  })
}
