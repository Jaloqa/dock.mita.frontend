import { describe, expect, it } from 'bun:test'
import { entriesApi } from '../../../../app/features/groups/api/entriesApi'
import { type GroupScope, linkScope, ownerScope } from '../../../../app/features/groups/utils/scope'
import { createApiClient } from '../../../../app/shared/api/client'
import type { GroupExpenseInput, GroupRepaymentInput } from '../../../../app/shared/api/contract'
import type { ApiRequest } from '../../../../app/shared/api/transport'

const TOKEN = 'albania-2026-demo-link-0123456789abcdefghij'

const expense: GroupExpenseInput = { payerId: 'gmb_olya', amount: 800, currency: 'EUR', date: '2026-10-23' }
const repayment: GroupRepaymentInput = {
  fromMemberId: 'gmb_olya',
  toMemberId: 'gmb_anna',
  amount: 500,
  currency: 'EUR',
  date: '2026-10-23',
}

async function requestsOf(scope: GroupScope): Promise<ApiRequest[]> {
  const requests: ApiRequest[] = []
  const api = entriesApi(
    createApiClient(async (request) => {
      requests.push(request)
      return request.method === 'GET' ? { items: [], page: 1, pageSize: 100, total: 0 } : {}
    }),
    scope,
  )
  await api.expenses(false, 1)
  await api.expenseHistory('gex_1', 1)
  await api.repayments(true, 1)
  await api.repaymentHistory('gpay_1', 1)
  await api.balances('PLN')
  await api.createExpense(expense)
  await api.updateExpense('gex_1', expense)
  await api.deleteExpense('gex_1')
  await api.restoreExpense('gex_1')
  await api.createRepayment(repayment)
  await api.updateRepayment('gpay_1', repayment)
  await api.deleteRepayment('gpay_1')
  await api.restoreRepayment('gpay_1')
  return requests
}

const writes = (requests: ApiRequest[]) => requests.filter((request) => request.method !== 'GET')

describe('entries api', () => {
  it('names the chosen member on every write through a link and on no read', async () => {
    const requests = await requestsOf(linkScope(TOKEN, 'gmb_olya'))

    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      `GET /v1/shared/groups/${TOKEN}/expenses`,
      `GET /v1/shared/groups/${TOKEN}/expenses/gex_1/history`,
      `GET /v1/shared/groups/${TOKEN}/repayments`,
      `GET /v1/shared/groups/${TOKEN}/repayments/gpay_1/history`,
      `GET /v1/shared/groups/${TOKEN}/balances`,
      `POST /v1/shared/groups/${TOKEN}/expenses`,
      `PUT /v1/shared/groups/${TOKEN}/expenses/gex_1`,
      `DELETE /v1/shared/groups/${TOKEN}/expenses/gex_1`,
      `POST /v1/shared/groups/${TOKEN}/expenses/gex_1/restore`,
      `POST /v1/shared/groups/${TOKEN}/repayments`,
      `PUT /v1/shared/groups/${TOKEN}/repayments/gpay_1`,
      `DELETE /v1/shared/groups/${TOKEN}/repayments/gpay_1`,
      `POST /v1/shared/groups/${TOKEN}/repayments/gpay_1/restore`,
    ])
    expect(writes(requests)).toHaveLength(8)
    for (const request of writes(requests)) expect(request.headers).toEqual({ 'X-Group-Member': 'gmb_olya' })
    for (const request of requests.filter((item) => item.method === 'GET')) expect('headers' in request).toBe(false)
  })

  it('sends the bodies unchanged through a link', async () => {
    const requests = await requestsOf(linkScope(TOKEN, 'gmb_olya'))

    expect(writes(requests).map((request) => request.body)).toEqual([
      expense,
      expense,
      undefined,
      undefined,
      repayment,
      repayment,
      undefined,
      undefined,
    ])
  })

  it('names no member when none is chosen and for the owner', async () => {
    for (const scope of [linkScope(TOKEN, null), ownerScope('grp_albania')]) {
      for (const request of await requestsOf(scope)) expect('headers' in request).toBe(false)
    }
  })
})
