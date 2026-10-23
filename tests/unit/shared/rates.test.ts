import { describe, expect, it } from 'bun:test'
import { createApiClient } from '../../../app/shared/api/client'
import type { RateDto } from '../../../app/shared/api/contract'
import type { ApiRequest } from '../../../app/shared/api/transport'
import { rateFrom, toBaseAmount } from '../../../app/shared/rates/convert'
import { rateKeys } from '../../../app/shared/rates/keys'
import { ratesApi } from '../../../app/shared/rates/ratesApi'

const rates: RateDto[] = [
  { date: '2026-10-15', from: 'EUR', to: 'PLN', value: 4.25 },
  { date: '2026-10-15', from: 'UAH', to: 'PLN', value: 0.0952 },
]

describe('rate conversion', () => {
  it('finds the rate of a pair and treats the same currency as 1', () => {
    expect(rateFrom(rates, 'EUR', 'PLN')).toBe(4.25)
    expect(rateFrom(rates, 'PLN', 'PLN')).toBe(1)
    expect(rateFrom(rates, 'USD', 'PLN')).toBeUndefined()
  })

  it('converts minor units into the base currency with rounding', () => {
    expect(toBaseAmount(1_000, 'EUR', 'PLN', rates)).toBe(4_250)
    expect(toBaseAmount(1_005, 'UAH', 'PLN', rates)).toBe(96)
    expect(toBaseAmount(500, 'PLN', 'PLN', [])).toBe(500)
    expect(toBaseAmount(500, 'USD', 'PLN', rates)).toBeUndefined()
  })

  it('scales by the minor units of both currencies', () => {
    const jpy: RateDto[] = [{ date: '2026-10-22', from: 'JPY', to: 'PLN', value: 0.024764 }]
    expect(toBaseAmount(1500, 'JPY', 'PLN', jpy)).toBe(3715)
    const kwd: RateDto[] = [{ date: '2026-10-22', from: 'KWD', to: 'PLN', value: 12.6221 }]
    expect(toBaseAmount(1250, 'KWD', 'PLN', kwd)).toBe(1578)
  })
})

describe('rates api', () => {
  it('reads /v1/rates unless it is given another path', async () => {
    const requests: ApiRequest[] = []
    const api = ratesApi(
      createApiClient(async (request) => {
        requests.push(request)
        return []
      }),
    )

    await api.list({ to: 'EUR', date: '2026-10-20' })
    await api.list({ to: 'EUR' }, '/v1/shared/groups/albania-2026-demo-link-0123456789abcdefghij/rates')

    expect(requests).toEqual([
      { method: 'GET', path: '/v1/rates', query: { to: 'EUR', date: '2026-10-20' } },
      {
        method: 'GET',
        path: '/v1/shared/groups/albania-2026-demo-link-0123456789abcdefghij/rates',
        query: { to: 'EUR' },
      },
    ])
  })

  it('keys a table of rates by the path it is read from', () => {
    expect(rateKeys.table('EUR')).toEqual(['rates', '/v1/rates', 'EUR', 'today'])
    expect(rateKeys.table('EUR', '2026-10-20', '/v1/rates')).toEqual(['rates', '/v1/rates', 'EUR', '2026-10-20'])
    expect(rateKeys.table('EUR', undefined, '/v1/shared/groups/token/rates')).toEqual([
      'rates',
      '/v1/shared/groups/token/rates',
      'EUR',
      'today',
    ])
  })
})
