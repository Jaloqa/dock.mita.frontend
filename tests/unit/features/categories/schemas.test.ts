import { describe, expect, it } from 'bun:test'
import {
  CATEGORY_NAME_MAX,
  categoryRules,
  isUniqueName,
  suggestColor,
} from '../../../../app/features/categories/schemas/categorySchema'

type Rule = { $validator: unknown; $message?: unknown }

const validate = (rule: Rule, value: unknown): boolean =>
  (rule.$validator as (value: unknown, ...context: unknown[]) => boolean)(value, {}, {}) === true

const message = (rule: Rule): string => (rule.$message as (params: unknown) => string)({})

describe('category form rules', () => {
  it('compares names ignoring case and surrounding spaces', () => {
    const unique = isUniqueName(() => ['Spożywcze', 'Inne'])
    expect(unique(' spożywcze ')).toBe(false)
    expect(unique('INNE')).toBe(false)
    expect(unique('Książki')).toBe(true)
    expect(unique('')).toBe(true)
  })

  it('reports required, too long and taken names with i18n keys', () => {
    const rules = categoryRules(
      (key) => key,
      () => ['Inne'],
    )
    expect(validate(rules.name.required, '')).toBe(false)
    expect(message(rules.name.required)).toBe('validation.required')
    expect(validate(rules.name.maxLength, 'x'.repeat(CATEGORY_NAME_MAX))).toBe(true)
    expect(validate(rules.name.maxLength, 'x'.repeat(CATEGORY_NAME_MAX + 1))).toBe(false)
    expect(validate(rules.name.maxLength, `  ${'x'.repeat(CATEGORY_NAME_MAX)}  `)).toBe(true)
    expect(message(rules.name.maxLength)).toBe('validation.nameTooLong')
    expect(validate(rules.name.unique, 'inne')).toBe(false)
    expect(message(rules.name.unique)).toBe('validation.categoryNameTaken')
    expect(validate(rules.color.required, 'chart-3')).toBe(true)
  })

  it('suggests the least used colour, the first token on ties', () => {
    expect(suggestColor([])).toBe('chart-1')
    expect(suggestColor([{ color: 'chart-1' }, { color: 'chart-2' }])).toBe('chart-3')
    expect(
      suggestColor([
        { color: 'chart-1' },
        { color: 'chart-1' },
        { color: 'chart-2' },
        { color: 'chart-3' },
        { color: 'chart-4' },
        { color: 'chart-5' },
        { color: 'chart-6' },
      ]),
    ).toBe('chart-2')
  })
})
