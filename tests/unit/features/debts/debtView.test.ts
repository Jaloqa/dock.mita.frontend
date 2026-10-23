import { describe, expect, it } from 'bun:test'
import { convertedPreview, repaidShare } from '../../../../app/features/debts/utils/debtView'

describe('debt view helpers', () => {
  it('gives the repaid share of a debt between 0 and 1', () => {
    expect(repaidShare({ amount: 50_000, repaid: 10_000 })).toBe(0.2)
    expect(repaidShare({ amount: 12_000, repaid: 12_000 })).toBe(1)
    expect(repaidShare({ amount: 5_000, repaid: 0 })).toBe(0)
  })

  it('previews the amount converted into the account currency', () => {
    expect(convertedPreview(50, 4.2563, 'EUR', 'PLN')).toBe(21_282)
    expect(convertedPreview(1500, 0.024764, 'JPY', 'PLN')).toBe(3_715)
    expect(convertedPreview(50, null, 'EUR', 'PLN')).toBeUndefined()
    expect(convertedPreview(50, 0, 'EUR', 'PLN')).toBeUndefined()
    expect(convertedPreview(null, 4.2563, 'EUR', 'PLN')).toBeUndefined()
    expect(convertedPreview(0, 4.2563, 'EUR', 'PLN')).toBeUndefined()
  })
})
