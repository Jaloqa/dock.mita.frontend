import type { CategoryDto, CategoryKind } from '../api/contract'

export const categoriesOfKind = (categories: readonly CategoryDto[], kind: CategoryKind): CategoryDto[] =>
  categories.filter((category) => category.kind === kind)

export const pickableCategories = (categories: readonly CategoryDto[], kind: CategoryKind): CategoryDto[] =>
  categoriesOfKind(categories, kind).filter((category) => category.system !== 'transfer')
