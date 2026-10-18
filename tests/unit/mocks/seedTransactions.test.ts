import { describe, expect, it } from 'bun:test'
import type { TransactionPage } from '../../../app/shared/api/contract'
import { addDaysIso } from '../../../app/shared/period/period'
import { accountBalances } from '../../../mocks/ledger'
import { seedState } from '../../../mocks/seed'
import { TRANSACTION_HISTORY_DAYS } from '../../../mocks/seed/transactions'
import { loggedInMockApi } from './session'

const seedDays = ['2026-10-16', '2026-03-01', '2026-12-31', '2027-02-28', '2027-07-09']
const users = ['usr_anna', 'usr_oleh']

describe('seeded transactions', () => {
  it.each(seedDays)('keeps the designed balances and non-negative opening balances when seeded on %s', (today) => {
    const state = seedState(today)
    const anna = accountBalances(state, 'usr_anna')
    const oleh = accountBalances(state, 'usr_oleh')
    expect(anna.get('acc_anna_card')).toBe(882_040)
    expect(anna.get('acc_anna_cash')).toBe(94_000)
    expect(anna.get('acc_anna_savings')).toBe(1_400_000)
    expect(oleh.get('acc_oleh_card')).toBe(2_450_000)
    expect(oleh.get('acc_oleh_cash')).toBe(720_000)
    for (const account of state.accounts) expect(account.openingBalance).toBeGreaterThanOrEqual(0)
  })

  it.each(seedDays)('covers about six months for both users up to %s', (today) => {
    const state = seedState(today)
    for (const userId of users) {
      const dates = state.transactions
        .filter((row) => row.userId === userId)
        .map((row) => row.date)
        .sort()
      expect(dates.length).toBeGreaterThan(200)
      expect((dates[0] ?? '') >= addDaysIso(today, -TRANSACTION_HISTORY_DAYS)).toBe(true)
      expect((dates[0] ?? '') <= addDaysIso(today, -175)).toBe(true)
      expect((dates.at(-1) ?? '') <= today).toBe(true)
    }
  })

  it('pays salary on the 10th and rent on the 5th every month', () => {
    const anna = seedState('2026-10-16').transactions.filter((row) => row.userId === 'usr_anna')
    const salary = anna.filter((row) => row.categoryId === 'cat_anna_income_salary')
    expect(salary.length).toBeGreaterThanOrEqual(6)
    expect(salary.every((row) => row.date.endsWith('-10') && row.amount === 740_000)).toBe(true)
    const rent = anna.filter((row) => row.title === 'Czynsz')
    expect(rent.length).toBeGreaterThanOrEqual(6)
    expect(rent.every((row) => row.date.endsWith('-05') && row.amount === 210_000)).toBe(true)
    const shops = new Set(anna.filter((row) => row.categoryId === 'cat_anna_expense_groceries').map((row) => row.title))
    expect(shops).toEqual(new Set(['Biedronka', 'Lidl', 'Żabka', 'Mercadona']))
  })

  it('has a few EUR payments from the PLN card converted at the rate of their day', () => {
    const anna = seedState('2026-10-16').transactions.filter((row) => row.userId === 'usr_anna')
    const eurFromCard = anna.filter((row) => row.currency === 'EUR' && row.accountId === 'acc_anna_card')
    expect(eurFromCard.length).toBeGreaterThanOrEqual(3)
    for (const row of eurFromCard) {
      expect(row.accountCurrency).toBe('PLN')
      expect(row.rate).toBeGreaterThan(4)
      expect(row.baseAmount).toBe(row.accountAmount)
    }
  })

  it('gives Oleh a UAH life with some USD', () => {
    const oleh = seedState('2026-10-16').transactions.filter((row) => row.userId === 'usr_oleh')
    expect(oleh.every((row) => row.baseCurrency === 'UAH')).toBe(true)
    const usd = oleh.filter((row) => row.currency === 'USD')
    expect(usd.length).toBeGreaterThanOrEqual(6)
    expect(usd.some((row) => row.kind === 'income')).toBe(true)
    expect(oleh.some((row) => row.categoryId === 'cat_oleh_expense_subscriptions')).toBe(true)
    expect(
      oleh.filter((row) => row.categoryId === 'cat_oleh_income_salary').every((row) => row.date.endsWith('-10')),
    ).toBe(true)
  })

  it('references only own categories of the same kind and own accounts', () => {
    const state = seedState('2026-10-16')
    for (const row of state.transactions) {
      const category = state.categories.find((candidate) => candidate.id === row.categoryId)
      expect(category?.userId).toBe(row.userId)
      expect(category?.kind).toBe(row.kind)
      expect(category?.system).not.toBe('transfer')
      expect(state.accounts.find((account) => account.id === row.accountId)?.userId).toBe(row.userId)
      expect(row.amount).toBeGreaterThan(0)
      expect(row.accountAmount).toBeGreaterThan(0)
      expect(row.baseAmount).toBeGreaterThan(0)
    }
  })

  it('produces the same transactions for a day whenever it is seeded', () => {
    const day = (today: string) =>
      seedState(today)
        .transactions.filter((row) => row.date === '2026-09-01')
        .map(({ id: _id, ...row }) => row)
    expect(day('2026-10-16').length).toBeGreaterThan(0)
    expect(day('2026-10-16')).toEqual(day('2026-10-20'))
  })

  it('serves the seeded history through the list endpoint', async () => {
    const mock = loggedInMockApi()
    const page = (await mock.handle({
      method: 'GET',
      path: '/v1/transactions',
      query: { search: 'Biedronka', pageSize: 5 },
    })) as TransactionPage
    expect(page.total).toBeGreaterThan(10)
    expect(page.items.every((item) => item.title === 'Biedronka')).toBe(true)
    expect(page.sum).toBeLessThan(0)
  })
})
