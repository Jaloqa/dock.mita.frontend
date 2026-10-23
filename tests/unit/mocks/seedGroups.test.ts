import { describe, expect, it } from 'bun:test'
import {
  type DebtPage,
  type GroupBalancesDto,
  type GroupDebtDto,
  type GroupDto,
  type GroupEntryEvent,
  type GroupExpenseDto,
  type GroupExpenseState,
  type GroupInviteDto,
  type GroupRepaymentDto,
  type GroupRepaymentState,
  type GroupSummaryDto,
  type Page,
  standardGroupCategories,
} from '../../../app/shared/api/contract'
import { addDaysIso, todayIso } from '../../../app/shared/period/period'
import { MockHttpError } from '../../../mocks/errors'
import { balancesOf, isStandardCategory } from '../../../mocks/groups'
import { seedState } from '../../../mocks/seed'
import { demoGroups } from '../../../mocks/seed/groups'
import { loggedInMockApi } from './session'

const seedDays = ['2026-10-16', '2026-03-01', '2026-12-31', '2027-05-31', '2027-07-09']

const ISO_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const [anna, olya, max, kasia] = ['gmb_anna', 'gmb_olya', 'gmb_max', 'gmb_kasia'] as const

const owner = { kind: 'owner', memberId: null, name: 'Anna Nowak' }

const path = (suffix = '') => `/v1/groups/grp_albania${suffix}`

const unlinked = { userId: null, invitedEmail: null, invitedAt: null }

describe('seeded groups', () => {
  it.each(seedDays)('seeds Albania 2026 with its members and the unused Beach category on %s', (today) => {
    const rows = demoGroups(today)
    expect(rows.groups.filter((row) => row.id === 'grp_albania')).toEqual([
      {
        id: 'grp_albania',
        userId: 'usr_anna',
        name: 'Albania 2026',
        currency: 'EUR',
        createdAt: expect.stringMatching(ISO_MILLISECONDS),
        shareToken: 'albania-2026-demo-link-0123456789abcdefghij',
      },
    ])
    expect(rows.groupMembers.filter((row) => row.groupId === 'grp_albania')).toEqual([
      { id: anna, groupId: 'grp_albania', name: 'Anna', position: 0, ...unlinked },
      { id: olya, groupId: 'grp_albania', name: 'Olya', position: 1, ...unlinked },
      { id: max, groupId: 'grp_albania', name: 'Max', position: 2, ...unlinked },
      { id: kasia, groupId: 'grp_albania', name: 'Kasia', position: 3, ...unlinked },
    ])
    expect(rows.groupCategories).toEqual([
      {
        id: 'gcat_beach',
        groupId: 'grp_albania',
        name: 'Beach',
        createdAt: expect.stringMatching(ISO_MILLISECONDS),
      },
    ])
    expect(rows.groupExpenses.every((row) => row.categoryId !== 'gcat_beach')).toBe(true)
  })

  it.each(seedDays)('seeds Kraków for Oleh with himself linked, Anna invited and no share link on %s', (today) => {
    const rows = demoGroups(today)
    const albania = rows.groups.find((row) => row.id === 'grp_albania')
    expect(rows.groups.map((row) => row.id)).toEqual(['grp_albania', 'grp_krakow'])
    expect(rows.groups[1]).toEqual({
      id: 'grp_krakow',
      userId: 'usr_oleh',
      name: 'Kraków',
      currency: 'PLN',
      createdAt: expect.stringMatching(ISO_MILLISECONDS),
      shareToken: null,
    })
    expect((rows.groups[1]?.createdAt ?? '') > (albania?.createdAt ?? '')).toBe(true)
    expect(rows.groupMembers.filter((row) => row.groupId === 'grp_krakow')).toEqual([
      { id: 'gmb_oleh', groupId: 'grp_krakow', name: 'Oleh', position: 0, ...unlinked, userId: 'usr_oleh' },
      {
        id: 'gmb_k_anna',
        groupId: 'grp_krakow',
        name: 'Anna',
        position: 1,
        userId: null,
        invitedEmail: 'anna@demo.mita.app',
        invitedAt: expect.stringMatching(ISO_MILLISECONDS),
      },
      { id: 'gmb_taras', groupId: 'grp_krakow', name: 'Taras', position: 2, ...unlinked },
    ])
    const [pierogi] = rows.groupExpenses.filter((row) => row.groupId === 'grp_krakow')
    expect(rows.groupExpenses.filter((row) => row.groupId === 'grp_krakow')).toHaveLength(1)
    expect(pierogi).toMatchObject({
      id: 'gex_pierogi',
      payerId: 'gmb_oleh',
      amount: 30_000,
      currency: 'PLN',
      date: addDaysIso(today, -5),
      categoryId: 'cafes',
      tags: [],
      description: 'Pierogi',
      rate: 1,
      rateManual: false,
      groupAmount: 30_000,
      split: 'equal',
      deleted: false,
    })
    expect(pierogi?.shares.map((share) => [share.memberId, share.amount, share.groupAmount])).toEqual([
      ['gmb_oleh', 10_000, 10_000],
      ['gmb_k_anna', 10_000, 10_000],
      ['gmb_taras', 10_000, 10_000],
    ])
    expect(rows.groupRepayments.filter((row) => row.groupId === 'grp_krakow')).toEqual([])
    expect(rows.groupCategories.filter((row) => row.groupId === 'grp_krakow')).toEqual([])
    const events = rows.groupEvents.filter((event) => event.groupId === 'grp_krakow')
    expect(events.map((event) => [event.entryId, event.action, event.actorUserId, event.actorMemberId])).toEqual([
      ['gex_pierogi', 'created', 'usr_oleh', null],
    ])
    expect(events[0]?.at).toMatch(ISO_MILLISECONDS)
    expect((events[0]?.at ?? '') >= (rows.groups[1]?.createdAt ?? '')).toBe(true)
    expect(events[0]?.state).toEqual(
      expect.objectContaining({ payerId: 'gmb_oleh', amount: 30_000, description: 'Pierogi' }),
    )
  })

  it.each(seedDays)('seeds the designed expenses on %s', (today) => {
    const groupExpenses = demoGroups(today).groupExpenses.filter((row) => row.groupId === 'grp_albania')
    expect(
      groupExpenses.map(
        ({
          id,
          groupId,
          payerId,
          amount,
          currency,
          date,
          categoryId,
          tags,
          description,
          rate,
          rateManual,
          groupAmount,
          split,
          shares,
          deleted,
        }) => ({
          id,
          groupId,
          payerId,
          amount,
          currency,
          date,
          categoryId,
          tags,
          description,
          rate,
          rateManual,
          groupAmount,
          split,
          shares: shares.map((share) => [share.memberId, share.amount, share.groupAmount]),
          deleted,
        }),
      ),
    ).toEqual([
      {
        id: 'gex_dinner',
        groupId: 'grp_albania',
        payerId: anna,
        amount: 12_000,
        currency: 'EUR',
        date: addDaysIso(today, -10),
        categoryId: 'cafes',
        tags: ['dinner'],
        description: 'Dinner',
        rate: 1,
        rateManual: false,
        groupAmount: 12_000,
        split: 'equal',
        shares: [
          [anna, 3_000, 3_000],
          [olya, 3_000, 3_000],
          [max, 3_000, 3_000],
          [kasia, 3_000, 3_000],
        ],
        deleted: false,
      },
      {
        id: 'gex_groceries',
        groupId: 'grp_albania',
        payerId: olya,
        amount: 300_000,
        currency: 'ALL',
        date: addDaysIso(today, -9),
        categoryId: 'groceries',
        tags: [],
        description: 'Groceries',
        rate: 0.0102326,
        rateManual: true,
        groupAmount: 3_070,
        split: 'equal',
        shares: [
          [anna, 75_000, 768],
          [olya, 75_000, 768],
          [max, 75_000, 767],
          [kasia, 75_000, 767],
        ],
        deleted: false,
      },
      {
        id: 'gex_boat',
        groupId: 'grp_albania',
        payerId: max,
        amount: 4_000,
        currency: 'EUR',
        date: addDaysIso(today, -8),
        categoryId: 'leisure',
        tags: [],
        description: 'Boat trip',
        rate: 1,
        rateManual: false,
        groupAmount: 4_000,
        split: 'equal',
        shares: [
          [anna, 2_000, 2_000],
          [max, 2_000, 2_000],
        ],
        deleted: false,
      },
      {
        id: 'gex_taxi',
        groupId: 'grp_albania',
        payerId: kasia,
        amount: 1_500,
        currency: 'EUR',
        date: addDaysIso(today, -6),
        categoryId: 'transport',
        tags: [],
        description: 'Taxi',
        rate: 1,
        rateManual: false,
        groupAmount: 1_500,
        split: 'equal',
        shares: [
          [anna, 375, 375],
          [olya, 375, 375],
          [max, 375, 375],
          [kasia, 375, 375],
        ],
        deleted: true,
      },
    ])
    for (const row of groupExpenses) {
      expect(row.shares.reduce((total, share) => total + share.amount, 0)).toBe(row.amount)
      expect(row.shares.reduce((total, share) => total + share.groupAmount, 0)).toBe(row.groupAmount)
      expect(row.createdAt).toMatch(ISO_MILLISECONDS)
      expect(isStandardCategory(row.categoryId)).toBe(true)
    }
  })

  it.each(seedDays)('seeds the repayment from Kasia to Anna on %s', (today) => {
    expect(demoGroups(today).groupRepayments).toEqual([
      {
        id: 'gpay_kasia_anna',
        groupId: 'grp_albania',
        fromMemberId: kasia,
        toMemberId: anna,
        amount: 2_000,
        currency: 'EUR',
        date: addDaysIso(today, -7),
        rate: 1,
        rateManual: false,
        groupAmount: 2_000,
        note: null,
        deleted: false,
        createdAt: expect.stringMatching(ISO_MILLISECONDS),
      },
    ])
  })

  it.each(seedDays)('records every change by the owner and keeps the last state equal to the row on %s', (today) => {
    const rows = demoGroups(today)
    const groupExpenses = rows.groupExpenses
    const groupRepayments = rows.groupRepayments
    const groupEvents = rows.groupEvents.filter((event) => event.groupId === 'grp_albania')
    const actionsOf = (entryId: string) =>
      groupEvents.filter((event) => event.entryId === entryId).map((event) => event.action)
    expect(actionsOf('gex_dinner')).toEqual(['created', 'updated'])
    expect(actionsOf('gex_groceries')).toEqual(['created'])
    expect(actionsOf('gex_boat')).toEqual(['created'])
    expect(actionsOf('gex_taxi')).toEqual(['created', 'deleted'])
    expect(actionsOf('gpay_kasia_anna')).toEqual(['created'])
    expect(groupEvents).toHaveLength(7)
    expect(new Set(rows.groupEvents.map((event) => event.id)).size).toBe(rows.groupEvents.length)
    for (const event of groupEvents) {
      expect(event.groupId).toBe('grp_albania')
      expect(event.actorUserId).toBe('usr_anna')
      expect(event.actorMemberId).toBeNull()
      expect(event.kind).toBe(event.entryId.startsWith('gpay_') ? 'repayment' : 'expense')
      expect(event.at).toMatch(ISO_MILLISECONDS)
      expect(event.at < `${today}T00:00:00.000Z`).toBe(true)
    }
    const dinner = groupEvents.filter((event) => event.entryId === 'gex_dinner')
    expect(dinner.map((event) => (event.state as GroupExpenseState).amount)).toEqual([10_000, 12_000])
    expect(dinner.map((event) => (event.state as GroupExpenseState).shares.map((share) => share.amount))).toEqual([
      [2_500, 2_500, 2_500, 2_500],
      [3_000, 3_000, 3_000, 3_000],
    ])
    expect(dinner[0]?.at < (dinner[1]?.at ?? '')).toBe(true)
    for (const row of groupExpenses) {
      const last = rows.groupEvents.filter((event) => event.entryId === row.id).at(-1)
      const { id: _id, deleted: _deleted, groupId: _groupId, createdAt: _createdAt, ...state } = row
      expect(last?.state).toEqual(state)
    }
    for (const row of groupRepayments) {
      const last = rows.groupEvents.filter((event) => event.entryId === row.id).at(-1)
      const { id: _id, deleted: _deleted, groupId: _groupId, createdAt: _createdAt, ...state } = row
      expect(last?.state).toEqual(state)
    }
  })

  it.each(seedDays)('gives the demo group the designed balances and transfers on %s', (today) => {
    const state = seedState(today)
    const group = state.groups.find((row) => row.id === 'grp_albania')
    expect(group).toBeDefined()
    const page = balancesOf(state, group as NonNullable<typeof group>, 'EUR', today)
    expect(page.total).toBe(19_070)
    expect(page.members.map((member) => member.balance)).toEqual([4_232, -698, -1_767, -1_767])
    expect(page.members.map((member) => member.memberId)).toEqual([anna, olya, max, kasia])
    expect(page.transfers).toEqual([
      { fromMemberId: max, toMemberId: anna, amount: 1_767 },
      { fromMemberId: kasia, toMemberId: anna, amount: 1_767 },
      { fromMemberId: olya, toMemberId: anna, amount: 698 },
    ])
    expect(page.members.reduce((total, member) => total + member.balance, 0)).toBe(0)
  })

  it.each(seedDays)('puts the demo group into the seed state on %s', (today) => {
    const state = seedState(today)
    const rows = demoGroups(today)
    expect(state.version).toBe(6)
    expect(state.groups).toEqual(rows.groups)
    expect(state.groupMembers).toEqual(rows.groupMembers)
    expect(state.groupCategories).toEqual(rows.groupCategories)
    expect(state.groupExpenses).toEqual(rows.groupExpenses)
    expect(state.groupRepayments).toEqual(rows.groupRepayments)
    expect(state.groupEvents).toEqual(rows.groupEvents)
  })

  it('serves the demo group to Anna with its totals, members and categories', async () => {
    const mock = loggedInMockApi()
    const list = (await mock.handle({ method: 'GET', path: '/v1/groups' })) as Page<GroupSummaryDto>
    expect(list.items).toEqual([
      { id: 'grp_albania', name: 'Albania 2026', currency: 'EUR', members: 4, total: 19_070, role: 'owner' },
    ])
    expect(list.total).toBe(1)

    const group = (await mock.handle({ method: 'GET', path: path() })) as GroupDto
    expect(group).toMatchObject({
      name: 'Albania 2026',
      currency: 'EUR',
      currencyLocked: true,
      total: 19_070,
      shareToken: 'albania-2026-demo-link-0123456789abcdefghij',
      role: 'owner',
      myMemberId: null,
    })
    const details = { linked: false, linkedName: null, invitedEmail: null }
    expect(group.members).toEqual([
      { id: anna, name: 'Anna', inUse: true, ...details },
      { id: olya, name: 'Olya', inUse: true, ...details },
      { id: max, name: 'Max', inUse: true, ...details },
      { id: kasia, name: 'Kasia', inUse: true, ...details },
    ])
    expect(group.categories).toEqual([
      ...standardGroupCategories.map((id) => ({ id, standard: true, name: null })),
      { id: 'gcat_beach', standard: false, name: 'Beach' },
    ])
  })

  it('serves the balances and the transfers of the demo group, also in another currency', async () => {
    const mock = loggedInMockApi()

    const page = (await mock.handle({ method: 'GET', path: path('/balances') })) as GroupBalancesDto

    expect(page).toMatchObject({ currency: 'EUR', groupCurrency: 'EUR', total: 19_070 })
    expect(page.members.map((member) => member.balance)).toEqual([4_232, -698, -1_767, -1_767])
    expect(page.transfers.map((transfer) => [transfer.fromMemberId, transfer.toMemberId, transfer.amount])).toEqual([
      [max, anna, 1_767],
      [kasia, anna, 1_767],
      [olya, anna, 698],
    ])
    const pln = (await mock.handle({
      method: 'GET',
      path: path('/balances'),
      query: { currency: 'PLN' },
    })) as GroupBalancesDto
    expect(pln).toMatchObject({ currency: 'PLN', groupCurrency: 'EUR' })
    expect(pln.total).toBeGreaterThan(19_070 * 4)
    expect(pln.total).toBeLessThan(19_070 * 4.6)
  })

  it('lists the live and the deleted entries of the demo group', async () => {
    const mock = loggedInMockApi()
    const today = todayIso()

    const live = (await mock.handle({ method: 'GET', path: path('/expenses') })) as Page<GroupExpenseDto>
    expect(live.items.map((expense) => [expense.id, expense.description, expense.date])).toEqual([
      ['gex_boat', 'Boat trip', addDaysIso(today, -8)],
      ['gex_groceries', 'Groceries', addDaysIso(today, -9)],
      ['gex_dinner', 'Dinner', addDaysIso(today, -10)],
    ])
    const deleted = (await mock.handle({
      method: 'GET',
      path: path('/expenses'),
      query: { deleted: 'true' },
    })) as Page<GroupExpenseDto>
    expect(deleted.items.map((expense) => expense.description)).toEqual(['Taxi'])
    expect(deleted.items[0]).toMatchObject({ deleted: true, createdBy: owner, updatedBy: owner })
    expect(live.items.map((expense) => expense.createdBy)).toEqual([owner, owner, owner])

    const dinner = live.items.find((expense) => expense.id === 'gex_dinner')
    expect(dinner).toMatchObject({ amount: 12_000, updatedBy: owner })
    expect(dinner?.shares.map((share) => share.amount)).toEqual([3_000, 3_000, 3_000, 3_000])
    expect(live.items.find((expense) => expense.id === 'gex_groceries')).toMatchObject({
      currency: 'ALL',
      amount: 300_000,
      rate: 0.0102326,
      rateManual: true,
      groupAmount: 3_070,
      updatedBy: null,
      updatedAt: null,
    })

    const repayments = (await mock.handle({ method: 'GET', path: path('/repayments') })) as Page<GroupRepaymentDto>
    expect(repayments.items.map((row) => [row.id, row.fromMemberId, row.toMemberId, row.amount])).toEqual([
      ['gpay_kasia_anna', kasia, anna, 2_000],
    ])
    expect(repayments.items[0]).toMatchObject({ createdBy: owner, updatedBy: null })
    const removed = (await mock.handle({
      method: 'GET',
      path: path('/repayments'),
      query: { deleted: 'true' },
    })) as Page<GroupRepaymentDto>
    expect(removed.items).toEqual([])
  })

  it('serves the history of the demo entries newest first', async () => {
    const mock = loggedInMockApi()

    const dinner = (await mock.handle({
      method: 'GET',
      path: path('/expenses/gex_dinner/history'),
    })) as Page<GroupEntryEvent<GroupExpenseState>>
    expect(dinner.total).toBe(2)
    expect(dinner.items.map((event) => [event.action, event.state.amount, event.actor])).toEqual([
      ['updated', 12_000, owner],
      ['created', 10_000, owner],
    ])
    expect(dinner.items.every((event) => ISO_MILLISECONDS.test(event.at))).toBe(true)

    const taxi = (await mock.handle({
      method: 'GET',
      path: path('/expenses/gex_taxi/history'),
    })) as Page<GroupEntryEvent<GroupExpenseState>>
    expect(taxi.items.map((event) => [event.action, event.state.amount])).toEqual([
      ['deleted', 1_500],
      ['created', 1_500],
    ])

    const repayment = (await mock.handle({
      method: 'GET',
      path: path('/repayments/gpay_kasia_anna/history'),
    })) as Page<GroupEntryEvent<GroupRepaymentState>>
    expect(repayment.items.map((event) => [event.action, event.state.amount])).toEqual([['created', 2_000]])
  })

  it('lets the demo group be edited like any other', async () => {
    const mock = loggedInMockApi()

    const restored = (await mock.handle({
      method: 'POST',
      path: path('/expenses/gex_taxi/restore'),
    })) as GroupExpenseDto
    expect(restored).toMatchObject({ id: 'gex_taxi', deleted: false, amount: 1_500 })

    const group = (await mock.handle({ method: 'GET', path: path() })) as GroupDto
    expect(group.total).toBe(20_570)
    const page = (await mock.handle({ method: 'GET', path: path('/balances') })) as GroupBalancesDto
    expect(page.members.reduce((total, member) => total + member.balance, 0)).toBe(0)
    const history = (await mock.handle({
      method: 'GET',
      path: path('/expenses/gex_taxi/history'),
    })) as Page<GroupEntryEvent<GroupExpenseState>>
    expect(history.items.map((event) => event.action)).toEqual(['restored', 'deleted', 'created'])
  })

  it('serves Kraków to Oleh as the owner who is linked to himself, with the invitation of Anna', async () => {
    const mock = loggedInMockApi('usr_oleh')

    const list = (await mock.handle({ method: 'GET', path: '/v1/groups' })) as Page<GroupSummaryDto>
    expect(list.items).toEqual([
      { id: 'grp_krakow', name: 'Kraków', currency: 'PLN', members: 3, total: 30_000, role: 'owner' },
    ])
    const group = (await mock.handle({ method: 'GET', path: '/v1/groups/grp_krakow' })) as GroupDto
    expect(group).toMatchObject({
      name: 'Kraków',
      currency: 'PLN',
      total: 30_000,
      shareToken: null,
      role: 'owner',
      myMemberId: 'gmb_oleh',
    })
    expect(group.members).toEqual([
      { id: 'gmb_oleh', name: 'Oleh', inUse: true, linked: true, linkedName: 'Oleh Kravets', invitedEmail: null },
      {
        id: 'gmb_k_anna',
        name: 'Anna',
        inUse: true,
        linked: false,
        linkedName: null,
        invitedEmail: 'anna@demo.mita.app',
      },
      { id: 'gmb_taras', name: 'Taras', inUse: true, linked: false, linkedName: null, invitedEmail: null },
    ])
    const balances = (await mock.handle({ method: 'GET', path: '/v1/groups/grp_krakow/balances' })) as GroupBalancesDto
    expect(balances.members.map((member) => member.balance)).toEqual([20_000, -10_000, -10_000])
    const lines = (await mock.handle({ method: 'GET', path: '/v1/debts/groups' })) as Page<GroupDebtDto>
    expect(lines.items).toEqual([{ groupId: 'grp_krakow', name: 'Kraków', currency: 'PLN', balance: 20_000 }])
    const summary = ((await mock.handle({ method: 'GET', path: '/v1/debts' })) as DebtPage).summary
    expect(summary.groups).toBe(1)
  })

  it('offers Anna the invitation to Kraków and adds the group to her debts once she accepts', async () => {
    const mock = loggedInMockApi()
    const before = ((await mock.handle({ method: 'GET', path: '/v1/debts' })) as DebtPage).summary
    expect(before.groups).toBe(0)

    const invites = (await mock.handle({ method: 'GET', path: '/v1/group-invites' })) as Page<GroupInviteDto>
    expect(invites.items).toEqual([
      {
        memberId: 'gmb_k_anna',
        groupId: 'grp_krakow',
        groupName: 'Kraków',
        memberName: 'Anna',
        ownerName: 'Oleh Kravets',
        invitedAt: expect.stringMatching(ISO_MILLISECONDS),
      },
    ])
    expect(((await mock.handle({ method: 'GET', path: '/v1/debts/groups' })) as Page<GroupDebtDto>).items).toEqual([])

    const accepted = (await mock.handle({
      method: 'POST',
      path: '/v1/group-invites/gmb_k_anna/accept',
    })) as GroupSummaryDto
    expect(accepted).toEqual({
      id: 'grp_krakow',
      name: 'Kraków',
      currency: 'PLN',
      members: 3,
      total: 30_000,
      role: 'member',
    })

    const lines = (await mock.handle({ method: 'GET', path: '/v1/debts/groups' })) as Page<GroupDebtDto>
    expect(lines.items).toEqual([{ groupId: 'grp_krakow', name: 'Kraków', currency: 'PLN', balance: -10_000 }])
    const after = ((await mock.handle({ method: 'GET', path: '/v1/debts' })) as DebtPage).summary
    expect(after).toEqual({ ...before, owedByMe: before.owedByMe + 10_000, groups: 1 })
    const list = (await mock.handle({ method: 'GET', path: '/v1/groups' })) as Page<GroupSummaryDto>
    expect(list.items.map((item) => [item.name, item.role])).toEqual([
      ['Kraków', 'member'],
      ['Albania 2026', 'owner'],
    ])
    const krakow = (await mock.handle({ method: 'GET', path: '/v1/groups/grp_krakow' })) as GroupDto
    expect(krakow).toMatchObject({ role: 'member', myMemberId: 'gmb_k_anna', shareToken: null })
    expect(krakow.members.map((member) => [member.linked, member.linkedName, member.invitedEmail])).toEqual([
      [true, null, null],
      [true, null, null],
      [false, null, null],
    ])
  })

  it('shows Oleh nothing of Albania', async () => {
    const mock = loggedInMockApi('usr_oleh')

    for (const request of [
      { method: 'GET', path: path() },
      { method: 'GET', path: path('/balances') },
      { method: 'GET', path: path('/expenses') },
      { method: 'GET', path: path('/repayments') },
    ] as const) {
      const error = await mock.handle(request).catch((failure: unknown) => failure)
      expect(error).toBeInstanceOf(MockHttpError)
      expect((error as MockHttpError).problem.status).toBe(404)
    }
  })
})
