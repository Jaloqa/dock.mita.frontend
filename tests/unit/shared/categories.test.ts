import { describe, expect, it } from 'bun:test'
import { type CategoryDto, categoryColors } from '../../../app/shared/api/contract'
import { categoryColorVar, categorySwatchClass } from '../../../app/shared/categories/colors'
import { categoriesOfKind, pickableCategories } from '../../../app/shared/categories/select'

const category = (id: string, kind: CategoryDto['kind'], system: CategoryDto['system'] = null): CategoryDto => ({
  id,
  name: id,
  kind,
  color: 'chart-1',
  system,
  inUse: false,
})

const categories = [
  category('groceries', 'expense'),
  category('salary', 'income'),
  category('other', 'expense', 'other'),
  category('transfer', 'expense', 'transfer'),
  category('otherIncome', 'income', 'other'),
]

describe('category colours', () => {
  it('maps every colour key to its own chart token', () => {
    expect(categoryColors.map(categorySwatchClass)).toEqual([
      'bg-chart-1',
      'bg-chart-2',
      'bg-chart-3',
      'bg-chart-4',
      'bg-chart-5',
      'bg-chart-6',
    ])
    expect(categoryColorVar('chart-2')).toBe('var(--mita-chart-2)')
  })

  it('falls back to a neutral token for an unknown key', () => {
    expect(categorySwatchClass('chart-9')).toBe('bg-chart-5')
    expect(categoryColorVar('red')).toBe('var(--mita-chart-5)')
  })
})

describe('category selection', () => {
  it('keeps the categories of one kind in order', () => {
    expect(categoriesOfKind(categories, 'expense').map((item) => item.id)).toEqual(['groceries', 'other', 'transfer'])
    expect(categoriesOfKind(categories, 'income').map((item) => item.id)).toEqual(['salary', 'otherIncome'])
  })

  it('leaves the transfer category out of pickers', () => {
    expect(pickableCategories(categories, 'expense').map((item) => item.id)).toEqual(['groceries', 'other'])
  })
})
