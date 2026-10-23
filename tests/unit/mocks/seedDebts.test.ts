import { describe, expect, it } from 'bun:test'
import type { AccountDto, DebtPage, Page } from '../../../app/shared/api/contract'
import { addDaysIso } from '../../../app/shared/period/period'
import { debtsOf, summarizeDebts } from '../../../mocks/debts'
import { accountBalances } from '../../../mocks/ledger'
import { seedState } from '../../../mocks/seed'
import { demoDebts, withDebtHistory } from '../../../mocks/seed/debts'
import { loggedInMockApi } from './session'

const seedDays = ['2026-10-16', '2026-03-01', '2026-12-31', '2027-05-31', '2027-07-09']

const names = (state: ReturnType<typeof seedState>, userId: string, status: 'open' | 'settled', today: string) =>
  debtsOf(state, userId, status, today).map((debt) => debt.counterparty)

describe('seeded debts', () => {
  it.each(seedDays)('gives Anna the designed debts on %s', (today) => {
    const state = seedState(today)
    expect(
      state.debts
        .filter((row) => row.userId === 'usr_anna')
        .map(
          ({ direction, counterparty, amount, currency, date, dueDate, accountId, accountAmount, rate, repaid }) => ({
            direction,
            counterparty,
            amount,
            currency,
            date,
            dueDate,
            accountId,
            accountAmount,
            rate,
            repaid,
          }),
        ),
    ).toEqual([
      {
        direction: 'lent',
        counterparty: 'Max',
        amount: 50_000,
        currency: 'PLN',
        date: addDaysIso(today, -20),
        dueDate: addDaysIso(today, 10),
        accountId: 'acc_anna_cash',
        accountAmount: 50_000,
        rate: 1,
        repaid: 10_000,
      },
      {
        direction: 'borrowed',
        counterparty: 'Mama',
        amount: 200_000,
        currency: 'PLN',
        date: addDaysIso(today, -60),
        dueDate: null,
        accountId: 'acc_anna_card',
        accountAmount: 200_000,
        rate: 1,
        repaid: 50_000,
      },
      {
        direction: 'lent',
        counterparty: 'Kasia',
        amount: 5_000,
        currency: 'EUR',
        date: addDaysIso(today, -40),
        dueDate: addDaysIso(today, -5),
        accountId: null,
        accountAmount: null,
        rate: null,
        repaid: 0,
      },
      {
        direction: 'lent',
        counterparty: 'Tomek',
        amount: 12_000,
        currency: 'PLN',
        date: addDaysIso(today, -90),
        dueDate: null,
        accountId: null,
        accountAmount: null,
        rate: null,
        repaid: 12_000,
      },
    ])
    expect(
      state.debts
        .filter((row) => row.userId === 'usr_oleh')
        .map(({ direction, counterparty, amount, currency, date, accountId }) => ({
          direction,
          counterparty,
          amount,
          currency,
          date,
          accountId,
        })),
    ).toEqual([
      {
        direction: 'borrowed',
        counterparty: 'Андрій',
        amount: 300_000,
        currency: 'UAH',
        date: addDaysIso(today, -15),
        accountId: null,
      },
    ])
  })

  it.each(seedDays)('seeds the designed repayments on %s', (today) => {
    const { debts, repayments } = demoDebts(today)
    const byCounterparty = (name: string) => debts.find((row) => row.counterparty === name)?.id ?? ''
    expect(
      repayments.map(({ debtId, date, amount, currency, rate, debtAmount, accountId, accountAmount }) => ({
        debtId,
        date,
        amount,
        currency,
        rate,
        debtAmount,
        accountId,
        accountAmount,
      })),
    ).toEqual([
      {
        debtId: byCounterparty('Max'),
        date: addDaysIso(today, -5),
        amount: 10_000,
        currency: 'PLN',
        rate: 1,
        debtAmount: 10_000,
        accountId: 'acc_anna_cash',
        accountAmount: 10_000,
      },
      {
        debtId: byCounterparty('Mama'),
        date: addDaysIso(today, -30),
        amount: 50_000,
        currency: 'PLN',
        rate: 1,
        debtAmount: 50_000,
        accountId: 'acc_anna_card',
        accountAmount: 50_000,
      },
      {
        debtId: byCounterparty('Tomek'),
        date: addDaysIso(today, -70),
        amount: 12_000,
        currency: 'PLN',
        rate: 1,
        debtAmount: 12_000,
        accountId: null,
        accountAmount: null,
      },
    ])
  })

  it.each(seedDays)('backs every repaid amount with repayments of the same debt on %s', (today) => {
    const { debts, repayments } = demoDebts(today)
    for (const debt of debts) {
      const own = repayments.filter((row) => row.debtId === debt.id)
      expect(own.reduce((sum, row) => sum + row.debtAmount, 0)).toBe(debt.repaid)
      expect(debt.repaid).toBeLessThanOrEqual(debt.amount)
      for (const row of own) expect(row.userId).toBe(debt.userId)
    }
    expect(new Set([...debts.map((row) => row.id), ...repayments.map((row) => row.id)]).size).toBe(
      debts.length + repayments.length,
    )
  })

  it.each(seedDays)('keeps the designed balances and non-negative opening balances on %s', (today) => {
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

  it.each(seedDays)('summarizes what Anna owes and is owed on %s', (today) => {
    const state = seedState(today)
    const summary = summarizeDebts(state, 'usr_anna', 'PLN', today)
    expect(summary).toMatchObject({ owedByMe: 150_000, open: 3, overdue: 1 })
    expect(summary.owedToMe).toBeGreaterThan(40_000 + 5_000 * 3.5)
    expect(summary.owedToMe).toBeLessThan(40_000 + 5_000 * 5)
    expect(names(state, 'usr_anna', 'open', today)).toEqual(['Kasia', 'Max', 'Mama'])
    expect(names(state, 'usr_anna', 'settled', today)).toEqual(['Tomek'])
  })

  it.each(seedDays)('gives Oleh one open debt in hryvnias on %s', (today) => {
    const state = seedState(today)
    expect(names(state, 'usr_oleh', 'open', today)).toEqual(['Андрій'])
    expect(names(state, 'usr_oleh', 'settled', today)).toEqual([])
    expect(summarizeDebts(state, 'usr_oleh', 'UAH', today)).toEqual({
      owedToMe: 0,
      owedByMe: 300_000,
      open: 1,
      overdue: 0,
    })
  })

  it('lowers the opening balance of an account by the debt legs and leaves the others', () => {
    const today = '2026-10-16'
    const designed = seedState(today).accounts
    const { debts, repayments } = demoDebts(today)
    const bare = withDebtHistory(designed, [], [])
    expect(bare).toEqual(designed)
    const lowered = withDebtHistory(designed, debts, repayments)
    const opening = (rows: typeof designed, id: string) => rows.find((row) => row.id === id)?.openingBalance ?? 0
    expect(opening(lowered, 'acc_anna_cash') - opening(designed, 'acc_anna_cash')).toBe(40_000)
    expect(opening(lowered, 'acc_anna_card') - opening(designed, 'acc_anna_card')).toBe(-150_000)
    expect(opening(lowered, 'acc_anna_savings')).toBe(opening(designed, 'acc_anna_savings'))
    expect(opening(lowered, 'acc_oleh_card')).toBe(opening(designed, 'acc_oleh_card'))
  })

  it('serves the seeded debts through the API with the summary and the repayment history', async () => {
    const mock = loggedInMockApi()
    const open = (await mock.handle({ method: 'GET', path: '/v1/debts' })) as DebtPage
    expect(open.currency).toBe('PLN')
    expect(open.items.map((debt) => [debt.counterparty, debt.status, debt.overdue, debt.remaining])).toEqual([
      ['Kasia', 'open', true, 5_000],
      ['Max', 'open', false, 40_000],
      ['Mama', 'open', false, 150_000],
    ])
    expect(open.summary).toMatchObject({ owedByMe: 150_000, open: 3, overdue: 1 })
    const settled = (await mock.handle({ method: 'GET', path: '/v1/debts', query: { status: 'settled' } })) as DebtPage
    expect(settled.items.map((debt) => [debt.counterparty, debt.status, debt.repayments])).toEqual([
      ['Tomek', 'settled', 1],
    ])
    const max = open.items.find((debt) => debt.counterparty === 'Max')
    const history = (await mock.handle({ method: 'GET', path: `/v1/debts/${max?.id}/repayments` })) as Page<unknown>
    expect(history.total).toBe(1)
    const accounts = (await mock.handle({ method: 'GET', path: '/v1/accounts' })) as Page<AccountDto>
    expect(accounts.items.find((account) => account.id === 'acc_anna_cash')).toMatchObject({
      balance: 94_000,
      inUse: true,
    })
  })

  it('shows Oleh only his own debts', async () => {
    const mock = loggedInMockApi('usr_oleh')
    const page = (await mock.handle({ method: 'GET', path: '/v1/debts' })) as DebtPage
    expect(page.currency).toBe('UAH')
    expect(page.items.map((debt) => debt.counterparty)).toEqual(['Андрій'])
  })
})
