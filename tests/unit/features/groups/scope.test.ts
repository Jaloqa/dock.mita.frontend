import { describe, expect, it } from 'bun:test'
import {
  canManage,
  isMemberRefusal,
  isShareToken,
  linkQueryEnabled,
  linkScope,
  memberHeaders,
  ratesPath,
  scopeKey,
  scopePath,
  unlessMemberRefusal,
  userScope,
} from '../../../../app/features/groups/utils/scope'
import { ApiError } from '../../../../app/shared/api/problem'

const TOKEN = 'albania-2026-demo-link-0123456789abcdefghij'

describe('group scope', () => {
  it('builds a user scope for a group id', () => {
    expect(userScope('grp_albania')).toEqual({ kind: 'user', groupId: 'grp_albania' })
  })

  it('builds a link scope for a token and the chosen member', () => {
    expect(linkScope(TOKEN, 'gmb_olya')).toEqual({ kind: 'link', token: TOKEN, memberId: 'gmb_olya' })
    expect(linkScope(TOKEN, null)).toEqual({ kind: 'link', token: TOKEN, memberId: null })
  })

  it('addresses the group below /v1/groups with the id encoded', () => {
    expect(scopePath(userScope('grp_albania'))).toBe('/v1/groups/grp_albania')
    expect(scopePath(userScope('a/b c'))).toBe('/v1/groups/a%2Fb%20c')
  })

  it('addresses a link below /v1/shared/groups with the token encoded', () => {
    expect(scopePath(linkScope(TOKEN, 'gmb_olya'))).toBe(`/v1/shared/groups/${TOKEN}`)
    expect(scopePath(linkScope('a/b c', null))).toBe('/v1/shared/groups/a%2Fb%20c')
  })

  it('keys the cache by the kind and the group id', () => {
    expect(scopeKey(userScope('grp_albania'))).toEqual(['user', 'grp_albania'])
  })

  it('keys a link by its token whoever the chosen member is', () => {
    expect(scopeKey(linkScope(TOKEN, 'gmb_olya'))).toEqual(['link', TOKEN])
    expect(scopeKey(linkScope(TOKEN, 'gmb_max'))).toEqual(['link', TOKEN])
    expect(scopeKey(linkScope(TOKEN, null))).toEqual(['link', TOKEN])
  })

  it('lets only the owner of the group manage it', () => {
    expect(canManage({ role: 'owner' })).toBe(true)
    expect(canManage({ role: 'member' })).toBe(false)
    expect(canManage({ role: 'link' })).toBe(false)
  })

  it('reads the rates of the user for a signed-in user and of the link for a link holder', () => {
    expect(ratesPath(userScope('grp_albania'))).toBe('/v1/rates')
    expect(ratesPath(linkScope(TOKEN, null))).toBe(`/v1/shared/groups/${TOKEN}/rates`)
  })

  it('names the chosen member in a header on a link only', () => {
    expect(memberHeaders(linkScope(TOKEN, 'gmb_olya'))).toEqual({ 'X-Group-Member': 'gmb_olya' })
    expect(memberHeaders(linkScope(TOKEN, null))).toEqual({})
    expect(memberHeaders(userScope('grp_albania'))).toEqual({})
  })
})

describe('isShareToken', () => {
  it('accepts 43 characters of the base64url alphabet', () => {
    expect(isShareToken(TOKEN)).toBe(true)
    expect(isShareToken(`${'A'.repeat(21)}_-${'z9'.repeat(10)}`)).toBe(true)
  })

  it.each([
    ['too short', TOKEN.slice(1)],
    ['too long', `${TOKEN}x`],
    ['empty', ''],
    ['a padding character', `${TOKEN.slice(1)}=`],
    ['a slash', `${TOKEN.slice(1)}/`],
    ['a space', `${TOKEN.slice(1)} `],
    ['a letter outside ASCII', `${TOKEN.slice(1)}ż`],
  ])('refuses a token with %s', (_, token) => {
    expect(isShareToken(token)).toBe(false)
  })
})

describe('linkQueryEnabled', () => {
  it('waits for the browser, so the server render never calls a link route', () => {
    expect(linkQueryEnabled(TOKEN, false)).toBe(false)
  })

  it('loads a well-formed link once the page is mounted', () => {
    expect(linkQueryEnabled(TOKEN, true)).toBe(true)
  })

  it('never loads a malformed link', () => {
    expect(linkQueryEnabled('not-a-share-token', true)).toBe(false)
    expect(linkQueryEnabled('not-a-share-token', false)).toBe(false)
  })
})

describe('isMemberRefusal', () => {
  it('recognises the refusal of a write without a current member', () => {
    expect(isMemberRefusal(new ApiError({ status: 403, title: 'Forbidden', code: 'group.memberRequired' }))).toBe(true)
  })

  it.each([
    ['another forbidden code', new ApiError({ status: 403, title: 'Forbidden', code: 'auth.xsrf' })],
    ['a forbidden answer without a code', new ApiError({ status: 403, title: 'Forbidden' })],
    ['a missing group', new ApiError({ status: 404, title: 'Not Found' })],
    ['the code on another status', new ApiError({ status: 400, title: 'Bad', code: 'group.memberRequired' })],
    ['an error that is not from the API', new Error('group.memberRequired')],
    ['nothing', undefined],
  ])('ignores %s', (_, error) => {
    expect(isMemberRefusal(error)).toBe(false)
  })
})

describe('unlessMemberRefusal', () => {
  it('keeps a refused member away from the error handler', () => {
    const handled: unknown[] = []
    unlessMemberRefusal((error) => handled.push(error))(
      new ApiError({ status: 403, title: 'Forbidden', code: 'group.memberRequired' }),
    )
    expect(handled).toEqual([])
  })

  it('hands every other error to the error handler', () => {
    const errors = [
      new ApiError({ status: 403, title: 'Forbidden', code: 'auth.xsrf' }),
      new ApiError({ status: 404, title: 'Not Found' }),
      new Error('boom'),
      undefined,
    ]
    const handled: unknown[] = []
    const handle = unlessMemberRefusal((error) => handled.push(error))
    for (const error of errors) handle(error)
    expect(handled).toEqual(errors)
  })
})
