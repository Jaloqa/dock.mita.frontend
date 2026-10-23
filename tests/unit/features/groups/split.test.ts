import { describe, expect, it } from 'bun:test'
import { equalPreview, exactLeft } from '../../../../app/features/groups/utils/split'

const [anna, olya, max, kasia] = ['gmb_anna', 'gmb_olya', 'gmb_max', 'gmb_kasia'] as const
const order = [anna, olya, max, kasia]

describe('equal split preview', () => {
  it('gives the remainder to the payer when the payer shares', () => {
    expect(equalPreview(10_000, [anna, olya, max], olya, order)).toEqual({
      [anna]: 3_333,
      [olya]: 3_334,
      [max]: 3_333,
    })
  })

  it('gives the remainder to the first member in member order when the payer does not share', () => {
    expect(equalPreview(10_000, [max, olya, anna], kasia, order)).toEqual({
      [anna]: 3_334,
      [olya]: 3_333,
      [max]: 3_333,
    })
    expect(equalPreview(10_000, [anna, olya, max], null, order)[anna]).toBe(3_334)
  })

  it('matches the example of the contract', () => {
    expect(equalPreview(10_001, [anna, olya, max], max, order)).toEqual({
      [anna]: 3_334,
      [olya]: 3_333,
      [max]: 3_334,
    })
  })

  it('leaves 0 to the members whose share rounds to nothing, payer first', () => {
    expect(equalPreview(2, [anna, olya, max], olya, order)).toEqual({ [anna]: 1, [olya]: 1, [max]: 0 })
    expect(equalPreview(1, [anna, olya, max], olya, order)).toEqual({ [anna]: 0, [olya]: 1, [max]: 0 })
  })

  it('always adds up to the amount', () => {
    for (const amount of [1, 7, 99, 10_000, 123_457]) {
      const shares = Object.values(equalPreview(amount, order, kasia, order))
      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(amount)
    }
  })

  it('previews nothing without members and zeros without an amount', () => {
    expect(equalPreview(10_000, [], anna, order)).toEqual({})
    expect(equalPreview(0, [anna, olya], anna, order)).toEqual({ [anna]: 0, [olya]: 0 })
  })
})

describe('exact split', () => {
  it('tells what is left to assign', () => {
    expect(exactLeft(10_000, [4_000, 5_000])).toBe(1_000)
    expect(exactLeft(10_000, [4_000, 6_000])).toBe(0)
  })

  it('is negative when too much is assigned', () => {
    expect(exactLeft(10_000, [4_000, 7_000])).toBe(-1_000)
  })

  it('is the whole amount when nothing is assigned', () => {
    expect(exactLeft(10_000, [])).toBe(10_000)
  })
})
