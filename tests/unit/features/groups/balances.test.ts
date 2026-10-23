import { describe, expect, it } from 'bun:test'
import { balanceKind, balancesIn, transfersIn } from '../../../../app/features/groups/utils/balances'
import type { GroupMemberBalanceDto, GroupTransferDto } from '../../../../app/shared/api/contract'

const transfer = (fromMemberId: string, toMemberId: string, amount: number): GroupTransferDto => ({
  fromMemberId,
  toMemberId,
  amount,
})

const member = (memberId: string, balance: number): GroupMemberBalanceDto => ({
  memberId,
  paid: 0,
  share: 0,
  sent: 0,
  received: 0,
  balance,
})

describe('balance kind', () => {
  it('tells who gets money back, who owes and who is settled', () => {
    expect(balanceKind(4_232)).toBe('getsBack')
    expect(balanceKind(-698)).toBe('owes')
    expect(balanceKind(0)).toBe('settled')
  })
})

describe('balances in another currency', () => {
  const main = [member('gmb_anna', 1), member('gmb_olya', -1), member('gmb_max', 0)]

  it('takes the caption from the main-currency balance and the amount from the shown one', () => {
    const shown = [member('gmb_max', 0), member('gmb_anna', 0), member('gmb_olya', 0)]
    expect(balancesIn(main, shown)).toEqual([
      { memberId: 'gmb_anna', balance: 0, kind: 'getsBack' },
      { memberId: 'gmb_olya', balance: 0, kind: 'owes' },
      { memberId: 'gmb_max', balance: 0, kind: 'settled' },
    ])
  })

  it('shows the main balances as they are when both lists are the same', () => {
    expect(balancesIn(main, main).map((row) => row.balance)).toEqual([1, -1, 0])
  })

  it('leaves out a member the shown currency does not have', () => {
    expect(balancesIn(main, [member('gmb_olya', -4)])).toEqual([{ memberId: 'gmb_olya', balance: -4, kind: 'owes' }])
  })
})

describe('transfers in another currency', () => {
  const main = [
    transfer('gmb_max', 'gmb_anna', 1_767),
    transfer('gmb_kasia', 'gmb_anna', 1_767),
    transfer('gmb_olya', 'gmb_anna', 698),
  ]

  it('keeps the main-currency payload and takes the shown amount of the same pair', () => {
    const shown = [
      transfer('gmb_olya', 'gmb_anna', 2_975),
      transfer('gmb_max', 'gmb_anna', 7_531),
      transfer('gmb_kasia', 'gmb_anna', 7_531),
    ]
    expect(transfersIn(main, shown)).toEqual([
      { transfer: main[0], amount: 7_531 },
      { transfer: main[1], amount: 7_531 },
      { transfer: main[2], amount: 2_975 },
    ])
  })

  it('shows the main transfers as they are when both lists are the same', () => {
    expect(transfersIn(main, main).map((row) => row.amount)).toEqual([1_767, 1_767, 698])
  })

  it('leaves out a transfer the shown currency does not have', () => {
    expect(transfersIn(main, [transfer('gmb_max', 'gmb_anna', 7_531)])).toEqual([{ transfer: main[0], amount: 7_531 }])
  })

  it('pairs repeated transfers of one pair in order', () => {
    const twice = [transfer('gmb_max', 'gmb_anna', 100), transfer('gmb_max', 'gmb_anna', 50)]
    const shown = [transfer('gmb_max', 'gmb_anna', 400), transfer('gmb_max', 'gmb_anna', 200)]
    expect(transfersIn(twice, shown).map((row) => row.amount)).toEqual([400, 200])
  })

  it('has nothing to show without transfers', () => {
    expect(transfersIn([], [])).toEqual([])
  })
})
