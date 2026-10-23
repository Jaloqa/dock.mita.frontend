import { GROUP_MEMBER_HEADER, SHARE_TOKEN_LENGTH } from '../../../shared/api/contract'
import { isApiError } from '../../../shared/api/problem'
import { RATES_PATH } from '../../../shared/rates/ratesApi'

export type GroupScope = { kind: 'owner'; groupId: string } | { kind: 'link'; token: string; memberId: string | null }

const SHARE_TOKEN_ALPHABET = /^[A-Za-z0-9_-]*$/

export const ownerScope = (groupId: string): GroupScope => ({ kind: 'owner', groupId })

export const linkScope = (token: string, memberId: string | null): GroupScope => ({ kind: 'link', token, memberId })

export const scopePath = (scope: GroupScope): string =>
  scope.kind === 'owner'
    ? `/v1/groups/${encodeURIComponent(scope.groupId)}`
    : `/v1/shared/groups/${encodeURIComponent(scope.token)}`

export const scopeKey = (scope: GroupScope): readonly string[] =>
  scope.kind === 'owner' ? [scope.kind, scope.groupId] : [scope.kind, scope.token]

export const canManage = (scope: GroupScope): boolean => scope.kind === 'owner'

export const ratesPath = (scope: GroupScope): string =>
  scope.kind === 'owner' ? RATES_PATH : `${scopePath(scope)}/rates`

export const memberHeaders = (scope: GroupScope): Record<string, string> =>
  scope.kind === 'link' && scope.memberId !== null ? { [GROUP_MEMBER_HEADER]: scope.memberId } : {}

export const isShareToken = (token: string): boolean =>
  token.length === SHARE_TOKEN_LENGTH && SHARE_TOKEN_ALPHABET.test(token)

export const linkQueryEnabled = (token: string, mounted: boolean): boolean => mounted && isShareToken(token)

export const isMemberRefusal = (error: unknown): boolean =>
  isApiError(error) && error.status === 403 && error.code === 'group.memberRequired'

export const unlessMemberRefusal =
  (handle: (error: unknown) => unknown) =>
  (error: unknown): void => {
    if (!isMemberRefusal(error)) handle(error)
  }
