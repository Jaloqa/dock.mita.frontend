import { describe, expect, it } from 'bun:test'
import type { AccountDto, Page, TransferDto } from '../../../app/shared/api/contract'
import { convertMinor } from '../../../app/shared/money/money'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import type { MockApi } from '../../../mocks/api'
import { oneYearAhead } from '../../../mocks/handlers/transfers'
import { rateOn } from '../../../mocks/rates'
import { loggedInMockApi } from './session'

const api = () => loggedInMockApi()
const today = todayIso()
const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)

const accountsOf = async (mock: MockApi) => {
  const page = (await mock.handle({ method: 'GET', path: '/v1/accounts' })) as Page<AccountDto>
  return Object.fromEntries(page.items.map((account) => [account.id, account]))
}

const transfer = (mock: MockApi, body: Record<string, unknown>) =>
  mock.handle({ method: 'POST', path: '/v1/transfers', body }) as Promise<TransferDto>

describe('transfers', () => {
  it('computes seeded balances from opening balances and transfers', async () => {
    const mock = api()
    const accounts = await accountsOf(mock)
    const eurIn = mock.db.state.transfers.find((row) => row.toAccountId === 'acc_anna_eur')?.toAmount ?? 0
    expect(accounts.acc_anna_card?.balance).toBe(882_040)
    expect(accounts.acc_anna_cash?.balance).toBe(94_000)
    expect(accounts.acc_anna_savings?.balance).toBe(1_400_000)
    expect(eurIn).toBeGreaterThan(40_000)
    expect(accounts.acc_anna_eur?.balance).toBe(42_000 + eurIn)
    expect(Object.values(accounts).every((account) => account.inUse)).toBe(true)
  })

  it('lists the session user transfers newest first with paging', async () => {
    const page = (await api().handle({
      method: 'GET',
      path: '/v1/transfers',
      query: { pageSize: 3 },
    })) as Page<TransferDto>
    expect(page).toMatchObject({ page: 1, pageSize: 3, total: 7 })
    expect(page.items[0]).toMatchObject({
      date: addDaysIso(today, -8),
      fromAccountId: 'acc_anna_card',
      toAccountId: 'acc_anna_savings',
      fromAmount: 100_000,
    })
    expect(page.items.map((item) => item.date)).toEqual([...page.items.map((item) => item.date)].sort().reverse())
    expect(page.items[0]).not.toHaveProperty('userId')
  })

  it('filters transfers by account', async () => {
    const page = (await api().handle({
      method: 'GET',
      path: '/v1/transfers',
      query: { accountId: 'acc_anna_cash' },
    })) as Page<TransferDto>
    expect(page.total).toBe(2)
  })

  it('moves money between same-currency accounts at rate 1', async () => {
    const mock = api()
    const created = await transfer(mock, {
      date: today,
      fromAccountId: 'acc_anna_card',
      toAccountId: 'acc_anna_cash',
      fromAmount: 25_000,
      rate: 3,
      note: '  Pocket money ',
    })
    expect(created).toMatchObject({ toAmount: 25_000, rate: 1, note: 'Pocket money' })
    expect(created.id).toStartWith('trf_')
    const accounts = await accountsOf(mock)
    expect(accounts.acc_anna_card?.balance).toBe(857_040)
    expect(accounts.acc_anna_cash?.balance).toBe(119_000)
    const list = (await mock.handle({ method: 'GET', path: '/v1/transfers' })) as Page<TransferDto>
    expect(list.items[0]?.id).toBe(created.id)
  })

  it('converts cross-currency transfers with the rate of the date unless one is given', async () => {
    const mock = api()
    const date = addDaysIso(today, -3)
    const body = { date, fromAccountId: 'acc_anna_card', toAccountId: 'acc_anna_eur', fromAmount: 100_000 }
    const rate = rateOn(mock.db.state.rates, date, 'PLN', 'EUR')
    expect(await transfer(mock, body)).toMatchObject({ rate, toAmount: convertMinor(100_000, rate), note: null })
    expect(await transfer(mock, { ...body, rate: 0.25 })).toMatchObject({ rate: 0.25, toAmount: 25_000 })
  })

  it('rejects a cross-currency transfer whose converted amount rounds to zero', async () => {
    const error = await failure(
      transfer(api(), { date: today, fromAccountId: 'acc_anna_card', toAccountId: 'acc_anna_eur', fromAmount: 1 }),
    )
    expect(error).toMatchObject({ problem: { status: 400, errors: { rate: ['validation.positiveAmount'] } } })
  })

  it('validates accounts, amount and date with i18n codes', async () => {
    const mock = api()
    expect(
      await failure(
        transfer(mock, {
          date: '2026-02-30',
          fromAccountId: 'acc_anna_card',
          toAccountId: 'acc_anna_card',
          fromAmount: 0,
          rate: -1,
        }),
      ),
    ).toMatchObject({
      problem: {
        status: 400,
        errors: {
          date: ['validation.invalidValue'],
          toAccountId: ['validation.sameAccount'],
          fromAmount: ['validation.positiveAmount'],
          rate: ['validation.invalidValue'],
        },
      },
    })
    expect(
      await failure(
        transfer(mock, {
          date: addDaysIso(oneYearAhead(today), 1),
          fromAccountId: 'acc_oleh_card',
          toAccountId: 'acc_nope',
          fromAmount: 100,
        }),
      ),
    ).toMatchObject({
      problem: {
        errors: {
          date: ['validation.dateTooFar'],
          fromAccountId: ['validation.unknownAccount'],
          toAccountId: ['validation.unknownAccount'],
        },
      },
    })
    expect(await failure(transfer(mock, {}))).toMatchObject({
      problem: {
        errors: {
          date: ['validation.required'],
          fromAccountId: ['validation.required'],
          toAccountId: ['validation.required'],
          fromAmount: ['validation.required'],
        },
      },
    })
  })

  it('rejects an amount that is too large or not a whole number of minor units as invalid', async () => {
    const body = { date: today, fromAccountId: 'acc_anna_card', toAccountId: 'acc_anna_savings' }
    for (const fromAmount of [100_000_000_001, 12.5, '100']) {
      expect(await failure(transfer(api(), { ...body, fromAmount }))).toMatchObject({
        problem: { status: 400, errors: { fromAmount: ['validation.invalidValue'] } },
      })
    }
    expect(await failure(transfer(api(), { ...body, fromAmount: -100 }))).toMatchObject({
      problem: { errors: { fromAmount: ['validation.positiveAmount'] } },
    })
  })

  it('refuses transfers involving an archived account', async () => {
    const mock = api()
    await mock.handle({
      method: 'PUT',
      path: '/v1/accounts/acc_anna_cash',
      body: { name: 'Gotówka', type: 'cash', currency: 'PLN', openingBalance: 34_000, archived: true },
    })
    const error = await failure(
      transfer(mock, { date: today, fromAccountId: 'acc_anna_card', toAccountId: 'acc_anna_cash', fromAmount: 100 }),
    )
    expect(error).toMatchObject({ problem: { errors: { toAccountId: ['validation.archivedAccount'] } } })
  })

  it('keeps used accounts from being deleted or changing currency', async () => {
    const mock = api()
    expect(await failure(mock.handle({ method: 'DELETE', path: '/v1/accounts/acc_anna_cash' }))).toMatchObject({
      problem: { status: 400, errors: { id: ['validation.accountInUse'] } },
    })
    expect(
      await failure(
        mock.handle({
          method: 'PUT',
          path: '/v1/accounts/acc_anna_cash',
          body: { name: 'Gotówka', type: 'cash', currency: 'EUR', openingBalance: 34_000 },
        }),
      ),
    ).toMatchObject({ problem: { errors: { currency: ['validation.currencyLocked'] } } })
  })

  it('keeps the two demo users apart', async () => {
    const mock = api()
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_oleh' } })
    const page = (await mock.handle({ method: 'GET', path: '/v1/transfers' })) as Page<TransferDto>
    expect(page.total).toBe(4)
    const accounts = await accountsOf(mock)
    expect(accounts.acc_oleh_card?.balance).toBe(2_450_000)
    expect(accounts.acc_oleh_cash?.balance).toBe(720_000)
    const error = await failure(
      transfer(mock, { date: today, fromAccountId: 'acc_anna_card', toAccountId: 'acc_oleh_cash', fromAmount: 100 }),
    )
    expect(error).toMatchObject({ problem: { errors: { fromAccountId: ['validation.unknownAccount'] } } })
  })
})
