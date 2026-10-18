import { describe, expect, it } from 'bun:test'
import type { AccountDto, AccountInput, Page } from '../../../app/shared/api/contract'
import type { MockApi } from '../../../mocks/api'
import { loggedInMockApi } from './session'

const api = () => loggedInMockApi()
const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)
const list = async (mock: MockApi) => (await mock.handle({ method: 'GET', path: '/v1/accounts' })) as Page<AccountDto>

const travel: AccountInput = { name: 'Travel', type: 'cash', currency: 'EUR', openingBalance: 12_550 }

describe('accounts', () => {
  it('lists only the accounts of the session user', async () => {
    const mock = api()
    const anna = await list(mock)
    expect(anna.items.map((account) => account.id)).toEqual([
      'acc_anna_card',
      'acc_anna_cash',
      'acc_anna_savings',
      'acc_anna_eur',
    ])
    expect(anna).toMatchObject({ page: 1, pageSize: 100, total: 4 })
    expect(anna.items.map((account) => [account.type, account.currency])).toEqual([
      ['card', 'PLN'],
      ['cash', 'PLN'],
      ['savings', 'PLN'],
      ['card', 'EUR'],
    ])
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_oleh' } })
    expect((await list(mock)).items.map((account) => [account.id, account.currency])).toEqual([
      ['acc_oleh_card', 'UAH'],
      ['acc_oleh_cash', 'UAH'],
      ['acc_oleh_usd', 'USD'],
    ])
  })

  it('never exposes userId or createdAt', async () => {
    const [account] = (await list(api())).items
    expect(Object.keys(account ?? {}).sort()).toEqual([
      'archived',
      'balance',
      'cardLast4',
      'currency',
      'id',
      'inUse',
      'linkedGoals',
      'name',
      'openingBalance',
      'type',
    ])
  })

  it('creates an account whose balance starts at the opening balance', async () => {
    const mock = api()
    const created = (await mock.handle({ method: 'POST', path: '/v1/accounts', body: travel })) as AccountDto
    expect(created).toMatchObject({
      name: 'Travel',
      type: 'cash',
      currency: 'EUR',
      openingBalance: 12_550,
      balance: 12_550,
      cardLast4: null,
      archived: false,
      inUse: false,
    })
    expect(created.id).toStartWith('acc_')
    expect((await list(mock)).items.at(-1)?.id).toBe(created.id)
  })

  it('keeps the last four digits only for cards', async () => {
    const mock = api()
    const card = await mock.handle({
      method: 'POST',
      path: '/v1/accounts',
      body: { ...travel, type: 'card', cardLast4: '1234' },
    })
    const cash = await mock.handle({ method: 'POST', path: '/v1/accounts', body: { ...travel, cardLast4: '1234' } })
    expect(card).toMatchObject({ cardLast4: '1234' })
    expect(cash).toMatchObject({ cardLast4: null })
  })

  it('trims the name and rejects invalid fields with i18n codes', async () => {
    const mock = api()
    expect(
      await mock.handle({ method: 'POST', path: '/v1/accounts', body: { ...travel, name: '  Trip  ' } }),
    ).toMatchObject({ name: 'Trip' })
    const error = await failure(
      mock.handle({
        method: 'POST',
        path: '/v1/accounts',
        body: { name: '   ', type: 'loan', currency: 'GBP', openingBalance: 1.5, cardLast4: '12a4' },
      }),
    )
    expect(error).toMatchObject({
      problem: {
        status: 400,
        errors: {
          name: ['validation.required'],
          type: ['validation.invalidValue'],
          currency: ['validation.invalidValue'],
          openingBalance: ['validation.invalidValue'],
          cardLast4: ['validation.cardLast4'],
        },
      },
    })
    const tooLong = await failure(
      mock.handle({ method: 'POST', path: '/v1/accounts', body: { ...travel, name: 'x'.repeat(41) } }),
    )
    expect(tooLong).toMatchObject({ problem: { errors: { name: ['validation.nameTooLong'] } } })
    const empty = await failure(mock.handle({ method: 'POST', path: '/v1/accounts', body: null }))
    expect(empty).toMatchObject({
      problem: {
        errors: {
          name: ['validation.required'],
          type: ['validation.required'],
          currency: ['validation.required'],
          openingBalance: ['validation.required'],
        },
      },
    })
  })

  it('updates and archives an own account and keeps the flag when it is omitted', async () => {
    const mock = api()
    const created = (await mock.handle({ method: 'POST', path: '/v1/accounts', body: travel })) as AccountDto
    const path = `/v1/accounts/${created.id}`
    expect(
      await mock.handle({ method: 'PUT', path, body: { ...travel, name: 'Trips', archived: true } }),
    ).toMatchObject({
      name: 'Trips',
      archived: true,
    })
    expect(await mock.handle({ method: 'PUT', path, body: { ...travel, currency: 'USD' } })).toMatchObject({
      currency: 'USD',
      archived: true,
    })
  })

  it('returns 404 for a foreign or missing account', async () => {
    const mock = api()
    const foreign = await failure(
      mock.handle({ method: 'PUT', path: '/v1/accounts/acc_oleh_cash', body: { ...travel, currency: 'UAH' } }),
    )
    const missing = await failure(mock.handle({ method: 'DELETE', path: '/v1/accounts/acc_missing' }))
    expect(foreign).toMatchObject({ problem: { status: 404 } })
    expect(missing).toMatchObject({ problem: { status: 404 } })
  })

  it('deletes an unused account', async () => {
    const mock = api()
    const created = (await mock.handle({ method: 'POST', path: '/v1/accounts', body: travel })) as AccountDto
    expect(await mock.handle({ method: 'DELETE', path: `/v1/accounts/${created.id}` })).toBeUndefined()
    expect((await list(mock)).items.some((account) => account.id === created.id)).toBe(false)
  })

  it('pages and rejects page parameters that are not positive integers', async () => {
    const mock = api()
    const second = (await mock.handle({
      method: 'GET',
      path: '/v1/accounts',
      query: { page: 2, pageSize: 3 },
    })) as Page<AccountDto>
    expect(second).toMatchObject({ page: 2, pageSize: 3, total: 4 })
    expect(second.items.map((account) => account.id)).toEqual(['acc_anna_eur'])
    const error = await failure(mock.handle({ method: 'GET', path: '/v1/accounts', query: { page: 0, pageSize: 101 } }))
    expect(error).toMatchObject({
      problem: { status: 400, errors: { page: ['validation.invalidValue'], pageSize: ['validation.invalidValue'] } },
    })
  })
})
