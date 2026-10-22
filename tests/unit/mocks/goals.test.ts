import { describe, expect, it } from 'bun:test'
import type { AccountDto, GoalDto, GoalPage, Page, TransferDto } from '../../../app/shared/api/contract'
import { convertMinor } from '../../../app/shared/money/money'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import type { MockApi } from '../../../mocks/api'
import { addMonthsToKey, goalStatus, monthlyHint, monthsBefore, monthsUntil } from '../../../mocks/goals'
import { oneYearAhead } from '../../../mocks/handlers/transfers'
import { accountBalances } from '../../../mocks/ledger'
import { rateOn } from '../../../mocks/rates'
import { loggedInMockApi, quoteRate } from './session'

const today = todayIso()
const thisMonth = today.slice(0, 7)
const vacation = { name: 'Wakacje', target: 800_000 }
const emergency = { name: 'Fundusz', target: 2_000_000, accountId: 'acc_anna_savings' }

const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)
const field = (name: string, code: string) => ({ problem: { status: 400, errors: { [name]: [code] } } })

const api = (): MockApi => {
  const mock = loggedInMockApi()
  mock.db.state.goals = []
  mock.db.state.goalContributions = []
  return mock
}

const list = (mock: MockApi) => mock.handle({ method: 'GET', path: '/v1/goals' }) as Promise<GoalPage>
const create = (mock: MockApi, body: unknown) =>
  mock.handle({ method: 'POST', path: '/v1/goals', body }) as Promise<GoalDto>
const update = (mock: MockApi, id: string, body: unknown) =>
  mock.handle({ method: 'PUT', path: `/v1/goals/${id}`, body }) as Promise<GoalDto>
const remove = (mock: MockApi, id: string) => mock.handle({ method: 'DELETE', path: `/v1/goals/${id}` })
const contribute = (mock: MockApi, id: string, body: unknown) =>
  mock.handle({ method: 'POST', path: `/v1/goals/${id}/contributions`, body }) as Promise<GoalDto>
const transfers = async (mock: MockApi) =>
  ((await mock.handle({ method: 'GET', path: '/v1/transfers', query: { pageSize: 100 } })) as Page<TransferDto>).items
const accountsOf = async (mock: MockApi) => {
  const page = (await mock.handle({ method: 'GET', path: '/v1/accounts' })) as Page<AccountDto>
  return Object.fromEntries(page.items.map((account) => [account.id, account]))
}
const addAccount = (mock: MockApi, body: Record<string, unknown>) =>
  mock.handle({ method: 'POST', path: '/v1/accounts', body: { openingBalance: 0, ...body } }) as Promise<AccountDto>
const balances = (mock: MockApi) => accountBalances(mock.db.state, 'usr_anna')
const annaSettings = (mock: MockApi) => {
  const settings = mock.db.state.settings.find((row) => row.userId === 'usr_anna')
  if (!settings) throw new Error('Anna has no settings')
  return settings
}

describe('goal rules', () => {
  it('counts calendar months to the deadline', () => {
    expect(monthsUntil('2027-06', '2026-10-16')).toBe(8)
    expect(monthsUntil('2026-10', '2026-10-31')).toBe(0)
    expect(monthsUntil('2027-01', '2026-12-31')).toBe(1)
    expect(monthsUntil('2026-09', '2026-10-01')).toBe(-1)
  })

  it('spreads the remainder over the months left and rounds up', () => {
    expect(monthlyHint(380_000, '2027-06', '2026-10-16')).toBe(47_500)
    expect(monthlyHint(110_000, '2027-01', '2026-10-16')).toBe(36_667)
    expect(monthlyHint(50_000, '2026-10', '2026-10-16')).toBe(50_000)
    expect(monthlyHint(50_000, null, '2026-10-16')).toBeNull()
    expect(monthlyHint(0, '2027-06', '2026-10-16')).toBeNull()
    expect(monthlyHint(50_000, '2026-09', '2026-10-16')).toBeNull()
  })

  it('derives the status from the saved amount and the deadline', () => {
    expect(goalStatus(800_000, 800_000, null, '2026-10-16')).toBe('reached')
    expect(goalStatus(900_000, 800_000, '2026-01', '2026-10-16')).toBe('reached')
    expect(goalStatus(100, 800_000, '2026-09', '2026-10-16')).toBe('overdue')
    expect(goalStatus(100, 800_000, '2026-10', '2026-10-16')).toBe('active')
    expect(goalStatus(100, 800_000, null, '2026-10-16')).toBe('active')
  })

  it('steps whole calendar months and clamps to the end of a shorter month', () => {
    expect(monthsBefore('2026-10-16', 3)).toBe('2026-07-16')
    expect(monthsBefore('2026-05-31', 3)).toBe('2026-02-28')
    expect(monthsBefore('2026-02-15', 3)).toBe('2025-11-15')
    expect(addMonthsToKey('2026-10', 3)).toBe('2027-01')
    expect(addMonthsToKey('2026-01', -1)).toBe('2025-12')
  })
})

describe('goals', () => {
  it('creates goals that start empty and lists them with a summary', async () => {
    const mock = api()
    const deadline = addMonthsToKey(thisMonth, 4)
    const goal = await create(mock, { ...vacation, name: '  Wakacje  ', deadline })
    expect(goal.id).toStartWith('goal_')
    expect(goal).toEqual({
      id: goal.id,
      name: 'Wakacje',
      target: 800_000,
      saved: 0,
      remaining: 800_000,
      percent: 0,
      monthly: 200_000,
      status: 'active',
      deadline,
      accountId: null,
      currency: 'PLN',
    })
    await create(mock, emergency)
    const page = await list(mock)
    expect(page).toMatchObject({
      page: 1,
      pageSize: 100,
      total: 2,
      currency: 'PLN',
      summary: { saved: 0, monthly: 0, active: 2 },
    })
    expect(page.items.map((item) => item.name)).toEqual(['Wakacje', 'Fundusz'])
    expect(page.items[1]).toMatchObject({ deadline: null, monthly: null, accountId: 'acc_anna_savings' })
  })

  it('validates name, target, deadline and the linked account', async () => {
    const mock = api()
    expect(await failure(create(mock, {}))).toMatchObject({
      problem: { status: 400, errors: { name: ['validation.required'], target: ['validation.required'] } },
    })
    const cases: [Record<string, unknown>, string, string][] = [
      [{ name: '   ' }, 'name', 'validation.required'],
      [{ name: 42 }, 'name', 'validation.invalidValue'],
      [{ name: 'x'.repeat(41) }, 'name', 'validation.nameTooLong'],
      [{ target: 0 }, 'target', 'validation.positiveAmount'],
      [{ target: -5 }, 'target', 'validation.positiveAmount'],
      [{ target: 10.5 }, 'target', 'validation.invalidValue'],
      [{ target: '100' }, 'target', 'validation.invalidValue'],
      [{ target: 100_000_000_001 }, 'target', 'validation.invalidValue'],
      [{ deadline: '2026-13' }, 'deadline', 'validation.invalidValue'],
      [{ deadline: '2026-10-01' }, 'deadline', 'validation.invalidValue'],
      [{ deadline: addMonthsToKey(thisMonth, -1) }, 'deadline', 'validation.deadlinePast'],
      [{ deadline: addMonthsToKey(thisMonth, 601) }, 'deadline', 'validation.invalidValue'],
      [{ accountId: 'acc_anna_card' }, 'accountId', 'validation.savingsAccountOnly'],
      [{ accountId: 'acc_oleh_usd' }, 'accountId', 'validation.unknownAccount'],
      [{ accountId: 'acc_missing' }, 'accountId', 'validation.unknownAccount'],
    ]
    for (const [patch, name, code] of cases) {
      expect(await failure(create(mock, { ...vacation, ...patch }))).toMatchObject(field(name, code))
    }
    expect(mock.db.state.goals).toHaveLength(0)
    expect(await create(mock, { ...vacation, name: 'x'.repeat(40), deadline: thisMonth })).toMatchObject({
      deadline: thisMonth,
      monthly: 800_000,
    })
    expect(await create(mock, { ...vacation, deadline: addMonthsToKey(thisMonth, 600) })).toMatchObject({
      status: 'active',
    })
  })

  it('links only active own savings accounts but keeps an existing link', async () => {
    const mock = api()
    const savings = await addAccount(mock, { name: 'Lokata', type: 'savings', currency: 'EUR' })
    const goal = await create(mock, { ...vacation, accountId: savings.id })
    await mock.handle({
      method: 'PUT',
      path: `/v1/accounts/${savings.id}`,
      body: { name: 'Lokata', type: 'savings', currency: 'EUR', openingBalance: 0, archived: true },
    })
    expect(await failure(create(mock, { ...vacation, accountId: savings.id }))).toMatchObject(
      field('accountId', 'validation.archivedAccount'),
    )
    expect(await update(mock, goal.id, { ...vacation, name: 'Wakacje 2027', accountId: savings.id })).toMatchObject({
      name: 'Wakacje 2027',
      accountId: savings.id,
    })
    expect(
      await failure(contribute(mock, goal.id, { amount: 1_000, date: today, fromAccountId: 'acc_anna_card' })),
    ).toMatchObject(field('accountId', 'validation.archivedAccount'))
  })

  it('keeps an unchanged past deadline on update and reports the goal as overdue', async () => {
    const mock = api()
    const goal = await create(mock, { ...vacation, deadline: thisMonth })
    const past = addMonthsToKey(thisMonth, -2)
    const row = mock.db.state.goals.find((item) => item.id === goal.id)
    if (!row) throw new Error('The goal was not stored')
    row.deadline = past
    expect(await update(mock, goal.id, { ...vacation, target: 900_000, deadline: past })).toMatchObject({
      target: 900_000,
      remaining: 900_000,
      deadline: past,
      status: 'overdue',
      monthly: null,
    })
    expect(
      await failure(update(mock, goal.id, { ...vacation, deadline: addMonthsToKey(thisMonth, -1) })),
    ).toMatchObject(field('deadline', 'validation.deadlinePast'))
    expect(await update(mock, goal.id, { ...vacation, deadline: null })).toMatchObject({
      deadline: null,
      status: 'active',
    })
  })

  it('adds an unlinked contribution to the goal without moving money', async () => {
    const mock = api()
    const goal = await create(mock, { ...vacation, deadline: addMonthsToKey(thisMonth, 4) })
    const before = balances(mock)
    const transferCount = mock.db.state.transfers.length
    expect(
      await contribute(mock, goal.id, { amount: 120_000, date: today, fromAccountId: 'acc_anna_card' }),
    ).toMatchObject({ id: goal.id, saved: 120_000, remaining: 680_000, percent: 15, monthly: 170_000 })
    expect(balances(mock)).toEqual(before)
    expect(mock.db.state.transfers).toHaveLength(transferCount)
    expect(mock.db.state.goalContributions).toEqual([
      {
        id: expect.stringMatching(/^gcn_/),
        userId: 'usr_anna',
        goalId: goal.id,
        date: today,
        amount: 120_000,
        currency: 'PLN',
        fromAccountId: 'acc_anna_card',
        transferId: null,
        baseAmount: 120_000,
        baseCurrency: 'PLN',
      },
    ])
    await contribute(mock, goal.id, { amount: 5_000, date: today })
    expect(mock.db.state.goalContributions[1]?.fromAccountId).toBeNull()
  })

  it('validates contributions', async () => {
    const mock = api()
    const goal = await create(mock, vacation)
    const linked = await create(mock, emergency)
    expect(await failure(contribute(mock, goal.id, {}))).toMatchObject({
      problem: { status: 400, errors: { amount: ['validation.required'], date: ['validation.required'] } },
    })
    const valid = { amount: 1_000, date: today, fromAccountId: 'acc_anna_card' }
    const cases: [string, Record<string, unknown>, string, string][] = [
      [goal.id, { amount: 0 }, 'amount', 'validation.positiveAmount'],
      [goal.id, { amount: 1.5 }, 'amount', 'validation.invalidValue'],
      [goal.id, { amount: 100_000_000_001 }, 'amount', 'validation.invalidValue'],
      [goal.id, { date: '2026-02-30' }, 'date', 'validation.invalidValue'],
      [goal.id, { date: addDaysIso(oneYearAhead(today), 1) }, 'date', 'validation.dateTooFar'],
      [goal.id, { fromAccountId: 'acc_oleh_card' }, 'fromAccountId', 'validation.unknownAccount'],
      [goal.id, { rate: -1 }, 'rate', 'validation.invalidValue'],
      [goal.id, { rate: 1_000_000_001 }, 'rate', 'validation.invalidValue'],
      [linked.id, { fromAccountId: undefined }, 'fromAccountId', 'validation.required'],
      [linked.id, { fromAccountId: 'acc_anna_savings' }, 'fromAccountId', 'validation.sameAccount'],
    ]
    for (const [id, patch, name, code] of cases) {
      expect(await failure(contribute(mock, id, { ...valid, ...patch }))).toMatchObject(field(name, code))
    }
    expect(mock.db.state.goalContributions).toHaveLength(0)
    expect(await failure(contribute(mock, 'goal_missing', valid))).toMatchObject({ problem: { status: 404 } })
  })

  it('turns a contribution to a linked goal into a transfer into its account', async () => {
    const mock = api()
    const goal = await create(mock, emergency)
    const before = balances(mock)
    expect(
      await contribute(mock, goal.id, { amount: 50_000, date: today, fromAccountId: 'acc_anna_card' }),
    ).toMatchObject({ saved: 50_000, remaining: 1_950_000, percent: 2 })
    const after = balances(mock)
    expect(after.get('acc_anna_card')).toBe((before.get('acc_anna_card') ?? 0) - 50_000)
    expect(after.get('acc_anna_savings')).toBe((before.get('acc_anna_savings') ?? 0) + 50_000)
    const [latest] = await transfers(mock)
    expect(latest).toMatchObject({
      date: today,
      fromAccountId: 'acc_anna_card',
      toAccountId: 'acc_anna_savings',
      fromAmount: 50_000,
      toAmount: 50_000,
      rate: 1,
      note: 'Fundusz',
    })
    expect(mock.db.state.goalContributions[0]).toMatchObject({
      amount: 50_000,
      currency: 'PLN',
      fromAccountId: 'acc_anna_card',
      transferId: latest?.id,
      baseAmount: 50_000,
    })
  })

  it('converts a cross-currency contribution with the rate of the date unless one is given', async () => {
    const mock = api()
    const goal = await create(mock, emergency)
    const date = addDaysIso(today, -3)
    const rate = rateOn(mock.db.state.rates, date, 'EUR', 'PLN')
    expect((await contribute(mock, goal.id, { amount: 10_000, date, fromAccountId: 'acc_anna_eur' })).saved).toBe(
      convertMinor(10_000, rate, 'EUR', 'PLN'),
    )
    expect(
      (await contribute(mock, goal.id, { amount: 10_000, date, fromAccountId: 'acc_anna_eur', rate: 4 })).saved,
    ).toBe(convertMinor(10_000, rate, 'EUR', 'PLN') + 40_000)
    const [latest] = await transfers(mock)
    expect(latest).toMatchObject({ fromAccountId: 'acc_anna_eur', fromAmount: 10_000, toAmount: 40_000, rate: 4 })
    expect(mock.db.state.goalContributions[1]).toMatchObject({
      amount: 10_000,
      currency: 'EUR',
      baseAmount: 40_000,
      baseCurrency: 'PLN',
    })
  })

  it('values a contribution into a foreign-currency account at the rate of its date', async () => {
    const mock = api()
    const savings = await addAccount(mock, { name: 'Lokata EUR', type: 'savings', currency: 'EUR' })
    const goal = await create(mock, { ...vacation, accountId: savings.id })
    const date = addDaysIso(today, -10)
    const updated = await contribute(mock, goal.id, {
      amount: 43_000,
      date,
      fromAccountId: 'acc_anna_card',
      rate: 0.25,
    })
    expect(updated.saved).toBe(convertMinor(10_750, rateOn(mock.db.state.rates, date, 'EUR', 'PLN'), 'EUR', 'PLN'))
    expect(balances(mock).get(savings.id)).toBe(10_750)
  })

  it('refuses a contribution whose account value needs a rate older than 30 days, even with a manual rate', async () => {
    const mock = api()
    const dinar = await addAccount(mock, { name: 'Lokata KWD', type: 'savings', currency: 'KWD' })
    const goal = await create(mock, { ...vacation, accountId: dinar.id })
    quoteRate(mock, 'KWD', 12.6221, addDaysIso(today, -40))
    const before = (await transfers(mock)).length
    const error = await failure(
      contribute(mock, goal.id, { amount: 10_000, date: today, fromAccountId: 'acc_anna_card', rate: 0.08 }),
    )
    expect(error).toMatchObject({ problem: { status: 503, code: 'rates.unavailable' } })
    expect(await transfers(mock)).toHaveLength(before)
    expect(mock.db.state.goalContributions).toHaveLength(0)
    quoteRate(mock, 'KWD', 12.6221, addDaysIso(today, -30))
    const updated = await contribute(mock, goal.id, {
      amount: 10_000,
      date: today,
      fromAccountId: 'acc_anna_card',
      rate: 0.08,
    })
    expect(updated.saved).toBe(convertMinor(8_000, 12.6221, 'KWD', 'PLN'))
  })

  it('lets contributions pass the target and reports the goal as reached', async () => {
    const mock = api()
    const goal = await create(mock, { name: 'Rower', target: 10_000, deadline: addMonthsToKey(thisMonth, 2) })
    expect(await contribute(mock, goal.id, { amount: 15_000, date: today })).toMatchObject({
      saved: 15_000,
      remaining: 0,
      percent: 150,
      status: 'reached',
      monthly: null,
    })
    expect(await contribute(mock, goal.id, { amount: 1_000, date: today })).toMatchObject({
      saved: 16_000,
      percent: 160,
    })
    expect((await list(mock)).summary).toMatchObject({ saved: 16_000, active: 0 })
  })

  it('reports the average monthly saving of the last three months', async () => {
    const mock = api()
    const goal = await create(mock, vacation)
    const linked = await create(mock, emergency)
    await contribute(mock, goal.id, { amount: 30_000, date: today })
    await contribute(mock, linked.id, { amount: 60_000, date: addDaysIso(today, -40), fromAccountId: 'acc_anna_card' })
    await contribute(mock, goal.id, { amount: 90_000, date: monthsBefore(today, 3) })
    await contribute(mock, goal.id, { amount: 12_000, date: addDaysIso(today, 5) })
    expect((await list(mock)).summary).toEqual({ saved: 192_000, monthly: 30_000, active: 2 })
  })

  it('keeps goals consistent when the base currency changes', async () => {
    const mock = api()
    const goal = await create(mock, vacation)
    const date = addDaysIso(today, -20)
    await contribute(mock, goal.id, { amount: 300_000, date })
    annaSettings(mock).baseCurrency = 'EUR'
    const toEur = rateOn(mock.db.state.rates, today, 'PLN', 'EUR')
    const page = await list(mock)
    expect(page.currency).toBe('EUR')
    expect(page.items[0]).toMatchObject({
      target: convertMinor(800_000, toEur, 'PLN', 'EUR'),
      saved: convertMinor(300_000, toEur, 'PLN', 'EUR'),
      currency: 'EUR',
    })
    expect(page.summary.monthly).toBe(
      Math.round(convertMinor(300_000, rateOn(mock.db.state.rates, date, 'PLN', 'EUR'), 'PLN', 'EUR') / 3),
    )
    expect(await update(mock, goal.id, { name: 'Wakacje', target: 200_000 })).toMatchObject({
      target: 200_000,
      saved: convertMinor(300_000, toEur, 'PLN', 'EUR'),
      currency: 'EUR',
    })
    expect(mock.db.state.goals[0]).toMatchObject({
      currency: 'EUR',
      target: 200_000,
      saved: convertMinor(300_000, toEur, 'PLN', 'EUR'),
    })
    annaSettings(mock).baseCurrency = 'PLN'
    const toPln = rateOn(mock.db.state.rates, today, 'EUR', 'PLN')
    expect((await list(mock)).items[0]?.target).toBe(convertMinor(200_000, toPln, 'EUR', 'PLN'))
  })

  it('serves, changes and deletes own goals only', async () => {
    const mock = api()
    const goal = await create(mock, vacation)
    mock.db.state.activeUserId = 'usr_oleh'
    expect((await list(mock)).items).toEqual([])
    expect(await failure(update(mock, goal.id, vacation))).toMatchObject({ problem: { status: 404 } })
    expect(await failure(remove(mock, goal.id))).toMatchObject({ problem: { status: 404 } })
    expect(await failure(contribute(mock, goal.id, { amount: 100, date: today }))).toMatchObject({
      problem: { status: 404 },
    })
    mock.db.state.activeUserId = 'usr_anna'
    expect((await list(mock)).items).toHaveLength(1)
  })

  it('deletes a goal with its contributions but keeps the transfers', async () => {
    const mock = api()
    const goal = await create(mock, emergency)
    await contribute(mock, goal.id, { amount: 50_000, date: today, fromAccountId: 'acc_anna_card' })
    const transferCount = mock.db.state.transfers.length
    expect(await remove(mock, goal.id)).toBeUndefined()
    expect(mock.db.state.goals).toEqual([])
    expect(mock.db.state.goalContributions).toEqual([])
    expect(mock.db.state.transfers).toHaveLength(transferCount)
    expect(await failure(remove(mock, goal.id))).toMatchObject({ problem: { status: 404 } })
  })

  it('counts linked goals per account and unlinks goals when their account is deleted', async () => {
    const mock = api()
    const savings = await addAccount(mock, { name: 'Lokata', type: 'savings', currency: 'PLN' })
    expect(savings.linkedGoals).toBe(0)
    await create(mock, { ...vacation, accountId: savings.id })
    await create(mock, { ...emergency, accountId: savings.id })
    const accounts = await accountsOf(mock)
    expect(accounts[savings.id]?.linkedGoals).toBe(2)
    expect(accounts.acc_anna_card?.linkedGoals).toBe(0)
    await mock.handle({ method: 'DELETE', path: `/v1/accounts/${savings.id}` })
    expect((await list(mock)).items.map((item) => item.accountId)).toEqual([null, null])
  })
})
