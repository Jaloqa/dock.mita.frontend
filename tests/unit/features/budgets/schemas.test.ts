import { describe, expect, it } from 'bun:test'
import {
  BUDGET_LIMIT_MAX,
  budgetRules,
  isPositiveLimit,
  isWithinLimitMax,
} from '../../../../app/features/budgets/schemas/budgetSchema'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

describe('budget form rules', () => {
  it('requires a category and a limit', () => {
    const rules = budgetRules((key) => key)
    expect(validate(rules.categoryId.required, null)).toBe(false)
    expect(validate(rules.categoryId.required, 'cat_1')).toBe(true)
    expect(validate(rules.limit.required, null)).toBe(false)
    expect(message(rules.limit.required)).toBe('validation.required')
  })

  it('accepts positive limits up to the maximum', () => {
    expect(isPositiveLimit(null)).toBe(true)
    expect(isPositiveLimit(0)).toBe(false)
    expect(isPositiveLimit(-1)).toBe(false)
    expect(isPositiveLimit(0.01)).toBe(true)
    expect(isWithinLimitMax(BUDGET_LIMIT_MAX)).toBe(true)
    expect(isWithinLimitMax(BUDGET_LIMIT_MAX + 1)).toBe(false)
    expect(isWithinLimitMax(null)).toBe(true)
    const rules = budgetRules((key) => key)
    expect(validate(rules.limit.positive, 0)).toBe(false)
    expect(message(rules.limit.positive)).toBe('validation.positiveAmount')
    expect(validate(rules.limit.max, BUDGET_LIMIT_MAX + 1)).toBe(false)
    expect(message(rules.limit.max)).toBe('validation.invalidValue')
  })
})
