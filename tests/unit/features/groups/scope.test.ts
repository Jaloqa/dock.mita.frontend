import { describe, expect, it } from 'bun:test'
import { canManage, ownerScope, scopeKey, scopePath } from '../../../../app/features/groups/utils/scope'

describe('group scope', () => {
  it('builds an owner scope for a group id', () => {
    expect(ownerScope('grp_albania')).toEqual({ kind: 'owner', groupId: 'grp_albania' })
  })

  it('addresses the group below /v1/groups with the id encoded', () => {
    expect(scopePath(ownerScope('grp_albania'))).toBe('/v1/groups/grp_albania')
    expect(scopePath(ownerScope('a/b c'))).toBe('/v1/groups/a%2Fb%20c')
  })

  it('keys the cache by the kind and the group id', () => {
    expect(scopeKey(ownerScope('grp_albania'))).toEqual(['owner', 'grp_albania'])
  })

  it('lets the owner manage the group', () => {
    expect(canManage(ownerScope('grp_albania'))).toBe(true)
  })
})
