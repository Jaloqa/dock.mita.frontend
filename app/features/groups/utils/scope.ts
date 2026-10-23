export type GroupScope = { kind: 'owner'; groupId: string }

export const ownerScope = (groupId: string): GroupScope => ({ kind: 'owner', groupId })

export const scopePath = (scope: GroupScope): string => `/v1/groups/${encodeURIComponent(scope.groupId)}`

export const scopeKey = (scope: GroupScope): readonly string[] => [scope.kind, scope.groupId]

export const canManage = (scope: GroupScope): boolean => scope.kind === 'owner'
