import { describe, expect, it } from 'bun:test'
import {
  contributionSources,
  dateOfMonthKey,
  goalHint,
  linkableAccounts,
  monthKeyOfDate,
  receivedAmount,
  savedShare,
} from '../../../../app/features/goals/utils/goalView'
import type { AccountDto } from '../../../../app/shared/api/contract'

const account = (id: string, patch: Partial<AccountDto> = {}): AccountDto => ({
  id,
  name: id,
  type: 'card',
  currency: 'PLN',
  openingBalance: 0,
  balance: 0,
  cardLast4: null,
  archived: false,
  inUse: false,
  linkedGoals: 0,
  ...patch,
})

describe('goal view helpers', () => {
  it('picks the hint for the state of the goal', () => {
    expect(goalHint({ status: 'reached', remaining: 0, monthly: null })).toEqual({
      key: 'goals.hint.reached',
      amount: null,
    })
    expect(goalHint({ status: 'overdue', remaining: 5_000, monthly: null })).toEqual({
      key: 'goals.hint.overdue',
      amount: 5_000,
    })
    expect(goalHint({ status: 'active', remaining: 380_000, monthly: 47_500 })).toEqual({
      key: 'goals.hint.monthly',
      amount: 47_500,
    })
    expect(goalHint({ status: 'active', remaining: 380_000, monthly: null })).toEqual({
      key: 'goals.hint.noDeadline',
      amount: null,
    })
  })

  it('caps the bar at a full track', () => {
    expect(savedShare(420_000, 800_000)).toBe(0.525)
    expect(savedShare(1_500, 1_000)).toBe(1)
    expect(savedShare(100, 0)).toBe(0)
  })

  it('converts between deadline months and local dates', () => {
    expect(monthKeyOfDate(new Date(2027, 5, 1))).toBe('2027-06')
    expect(monthKeyOfDate(new Date(2027, 0, 31, 23, 59))).toBe('2027-01')
    const date = dateOfMonthKey('2027-06')
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2027, 5, 1])
  })

  it('offers active savings accounts for linking and keeps the current link', () => {
    const accounts = [
      account('card'),
      account('savings', { type: 'savings' }),
      account('old', { type: 'savings', archived: true }),
      account('cash', { type: 'cash' }),
    ]
    expect(linkableAccounts(accounts, null).map((item) => item.id)).toEqual(['savings'])
    expect(linkableAccounts(accounts, 'old').map((item) => item.id)).toEqual(['savings', 'old'])
  })

  it('offers active accounts other than the linked one as sources', () => {
    const accounts = [account('card'), account('savings', { type: 'savings' }), account('cash', { archived: true })]
    expect(contributionSources(accounts, 'savings').map((item) => item.id)).toEqual(['card'])
    expect(contributionSources(accounts, null).map((item) => item.id)).toEqual(['card', 'savings'])
  })

  it('previews what the linked account receives', () => {
    expect(receivedAmount(100, 4, 'EUR', 'PLN')).toBe(40_000)
    expect(receivedAmount(430, 0.25, 'PLN', 'EUR')).toBe(10_750)
    expect(receivedAmount(1500, 0.024764, 'JPY', 'PLN')).toBe(3_715)
    expect(receivedAmount(1.25, 12.6221, 'KWD', 'PLN')).toBe(1_578)
    expect(receivedAmount(null, 4, 'EUR', 'PLN')).toBeUndefined()
    expect(receivedAmount(0, 4, 'EUR', 'PLN')).toBeUndefined()
    expect(receivedAmount(100, null, 'EUR', 'PLN')).toBeUndefined()
    expect(receivedAmount(100, 0, 'EUR', 'PLN')).toBeUndefined()
  })
})
