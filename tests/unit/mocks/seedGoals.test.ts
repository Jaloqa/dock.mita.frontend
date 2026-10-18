import { describe, expect, it } from 'bun:test'
import type { AccountDto, GoalPage, Page } from '../../../app/shared/api/contract'
import { addDaysIso } from '../../../app/shared/period/period'
import { addMonthsToKey, goalsOf, summarizeGoals } from '../../../mocks/goals'
import { accountBalances } from '../../../mocks/ledger'
import { seedState } from '../../../mocks/seed'
import { loggedInMockApi } from './session'

const seedDays = ['2026-10-16', '2026-03-01', '2026-12-31', '2027-05-31', '2027-07-09']

describe('seeded goals', () => {
  it.each(seedDays)('gives Anna the designed goals and a monthly saving of 1 400 zł on %s', (today) => {
    const state = seedState(today)
    const month = today.slice(0, 7)
    expect(
      state.goals
        .filter((row) => row.userId === 'usr_anna')
        .map(({ name, target, saved, currency, deadline, accountId }) => ({
          name,
          target,
          saved,
          currency,
          deadline,
          accountId,
        })),
    ).toEqual([
      {
        name: 'Wakacje',
        target: 800_000,
        saved: 420_000,
        currency: 'PLN',
        deadline: addMonthsToKey(month, 8),
        accountId: null,
      },
      {
        name: 'Fundusz awaryjny',
        target: 2_000_000,
        saved: 620_000,
        currency: 'PLN',
        deadline: null,
        accountId: 'acc_anna_savings',
      },
      {
        name: 'Nowy laptop',
        target: 500_000,
        saved: 390_000,
        currency: 'PLN',
        deadline: addMonthsToKey(month, 3),
        accountId: null,
      },
    ])
    expect(summarizeGoals(state, 'usr_anna', goalsOf(state, 'usr_anna', today), today)).toEqual({
      saved: 1_430_000,
      monthly: 140_000,
      active: 3,
    })
  })

  it.each(seedDays)('backs every saved amount with contributions and keeps the designed balances on %s', (today) => {
    const state = seedState(today)
    for (const goal of state.goals) {
      const own = state.goalContributions.filter((row) => row.goalId === goal.id)
      expect(own.length).toBeGreaterThan(0)
      expect(own.reduce((sum, row) => sum + row.baseAmount, 0)).toBe(goal.saved)
      for (const row of own) {
        expect(row).toMatchObject({ userId: goal.userId, baseCurrency: goal.currency })
        expect(row.date <= today && row.date >= addDaysIso(today, -175)).toBe(true)
        if (goal.accountId === null) expect(row.transferId).toBeNull()
        else {
          expect(state.transfers.find((transfer) => transfer.id === row.transferId)).toMatchObject({
            userId: goal.userId,
            date: row.date,
            fromAccountId: row.fromAccountId,
            toAccountId: goal.accountId,
            fromAmount: row.amount,
            note: goal.name,
          })
        }
      }
    }
    const anna = accountBalances(state, 'usr_anna')
    const oleh = accountBalances(state, 'usr_oleh')
    expect(anna.get('acc_anna_card')).toBe(882_040)
    expect(anna.get('acc_anna_savings')).toBe(1_400_000)
    expect(oleh.get('acc_oleh_card')).toBe(2_450_000)
    for (const account of state.accounts) expect(account.openingBalance).toBeGreaterThanOrEqual(0)
  })

  it('gives Oleh UAH goals with a linked, an open-ended and a reached one', () => {
    const today = '2026-10-16'
    const goals = goalsOf(seedState(today), 'usr_oleh', today)
    expect(goals.map((goal) => [goal.name, goal.status, goal.deadline === null, goal.accountId])).toEqual([
      ['Ноутбук', 'active', false, 'acc_oleh_usd'],
      ['Подушка безпеки', 'active', true, null],
      ['Велосипед', 'reached', false, null],
    ])
    expect(goals.every((goal) => goal.currency === 'UAH')).toBe(true)
    expect(goals[0]?.saved).toBeGreaterThan(1_990_000)
    expect(goals[0]?.saved).toBeLessThan(2_010_000)
    expect(goals[1]).toMatchObject({ saved: 3_500_000, monthly: null })
    expect(goals[2]).toMatchObject({ saved: 1_800_000, percent: 100, monthly: null })
  })

  it('serves the design figures through the API and marks the savings account as linked', async () => {
    const mock = loggedInMockApi()
    const page = (await mock.handle({ method: 'GET', path: '/v1/goals' })) as GoalPage
    expect(page.summary).toEqual({ saved: 1_430_000, monthly: 140_000, active: 3 })
    expect(page.items.map((goal) => [goal.name, goal.percent, goal.monthly])).toEqual([
      ['Wakacje', 52, 47_500],
      ['Fundusz awaryjny', 31, null],
      ['Nowy laptop', 78, 36_667],
    ])
    const accounts = (await mock.handle({ method: 'GET', path: '/v1/accounts' })) as Page<AccountDto>
    expect(accounts.items.map((account) => [account.id, account.linkedGoals])).toEqual([
      ['acc_anna_card', 0],
      ['acc_anna_cash', 0],
      ['acc_anna_savings', 1],
      ['acc_anna_eur', 0],
    ])
  })
})
