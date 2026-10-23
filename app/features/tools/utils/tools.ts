import type { IconName } from '~/shared/types/icon'

export type ToolKey = 'groups' | 'debts'

export type ToolEntry = { key: ToolKey; to: string; icon: IconName }

export const tools: readonly ToolEntry[] = [
  { key: 'groups', to: '/tools/groups', icon: 'groups' },
  { key: 'debts', to: '/tools/debts', icon: 'debts' },
]
