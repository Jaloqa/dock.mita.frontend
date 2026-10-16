import { isReportRange, type ReportDto } from '../../app/shared/api/contract'
import { todayIso } from '../../app/shared/period/period'
import { badRequest } from '../errors'
import { reportOf } from '../reports'
import type { MockRouter } from '../router'

export function registerReportHandlers(router: MockRouter) {
  router.on('GET', '/v1/reports', ({ db, userId, query }): ReportDto => {
    const { range } = query
    if (range !== undefined && !isReportRange(range)) badRequest({ range: ['validation.invalidValue'] })
    return reportOf(db, userId, isReportRange(range) ? range : '6m', todayIso())
  })
}
