import { type CategoryColor, categoryColors } from '../api/contract'

const FALLBACK: CategoryColor = 'chart-5'

const swatchClasses: Record<CategoryColor, string> = {
  'chart-1': 'bg-chart-1',
  'chart-2': 'bg-chart-2',
  'chart-3': 'bg-chart-3',
  'chart-4': 'bg-chart-4',
  'chart-5': 'bg-chart-5',
  'chart-6': 'bg-chart-6',
}

const known = (color: string): CategoryColor =>
  categoryColors.includes(color as CategoryColor) ? (color as CategoryColor) : FALLBACK

export const categorySwatchClass = (color: string): string => swatchClasses[known(color)]

export const categoryColorVar = (color: string): string => `var(--mita-${known(color)})`
