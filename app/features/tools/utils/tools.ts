import type { IconName } from '~/shared/types/icon'

export type ToolKey = 'debts'

export type ToolEntry = { key: ToolKey; to: string; icon: IconName }

export const tools: readonly ToolEntry[] = [{ key: 'debts', to: '/tools/debts', icon: 'debts' }]
