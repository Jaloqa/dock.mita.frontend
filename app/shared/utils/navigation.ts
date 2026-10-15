import type { IconName } from '~/shared/types/icon'

export type NavigationItem = {
  key: 'overview' | 'transactions' | 'budgets' | 'goals' | 'accounts' | 'reports' | 'settings'
  to: string
  icon: IconName
}

export const primaryNavigation: NavigationItem[] = [
  { key: 'overview', to: '/', icon: 'overview' },
  { key: 'transactions', to: '/transactions', icon: 'transactions' },
  { key: 'budgets', to: '/budgets', icon: 'budgets' },
  { key: 'goals', to: '/goals', icon: 'goals' },
  { key: 'accounts', to: '/accounts', icon: 'accounts' },
  { key: 'reports', to: '/reports', icon: 'reports' },
]

export const settingsNavigation: NavigationItem = { key: 'settings', to: '/settings', icon: 'settings' }

export const mobileNavigation: { start: NavigationItem[]; end: NavigationItem[] } = {
  start: primaryNavigation.filter((item) => item.key === 'overview' || item.key === 'transactions'),
  end: primaryNavigation.filter((item) => item.key === 'goals' || item.key === 'reports'),
}
