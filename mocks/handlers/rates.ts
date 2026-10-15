import type { RateDto } from '../../app/shared/api/contract'
import { type Currency, currencies } from '../../app/shared/money/money'
import { isIsoDate, todayIso } from '../../app/shared/period/period'
import { rateOn } from '../rates'
import type { MockRouter } from '../router'
import { collectErrors, isCurrency } from '../validation'

export function registerRateHandlers(router: MockRouter) {
  router.on('GET', '/v1/rates', ({ db, query }): RateDto[] => {
    const errors = collectErrors()
    if (query.date !== undefined && !isIsoDate(query.date)) errors.add('date', 'validation.invalidValue')
    if (query.from !== undefined && !isCurrency(query.from)) errors.add('from', 'validation.invalidValue')
    if (query.to !== undefined && !isCurrency(query.to)) errors.add('to', 'validation.invalidValue')
    errors.throwIfAny()
    const date = query.date ?? todayIso()
    const sources: readonly Currency[] = query.from ? [query.from as Currency] : currencies
    const targets: readonly Currency[] = query.to ? [query.to as Currency] : currencies
    return sources.flatMap((from) =>
      targets
        .filter((to) => to !== from)
        .map((to) => ({ date, from, to, value: rateOn(db.state.rates, date, from, to) })),
    )
  })
}
