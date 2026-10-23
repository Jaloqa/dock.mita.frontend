import { describe, expect, it } from 'bun:test'
import { groupsApi } from '../../../../app/features/groups/api/groupsApi'
import { linkScope, userScope } from '../../../../app/features/groups/utils/scope'
import { createApiClient } from '../../../../app/shared/api/client'
import type { GroupDto, GroupMemberDto, GroupSummaryDto } from '../../../../app/shared/api/contract'
import type { ApiRequest } from '../../../../app/shared/api/transport'

describe('groups api', () => {
  it('adds a category below the path of the scope it is given', async () => {
    const requests: ApiRequest[] = []
    const api = groupsApi(
      createApiClient(async (request) => {
        requests.push(request)
        return { id: 'gcat_ferry', standard: false, name: 'Ferry' }
      }),
    )

    await api.addCategory(userScope('grp/albania'), { name: 'Ferry' })

    expect(requests).toEqual([{ method: 'POST', path: '/v1/groups/grp%2Falbania/categories', body: { name: 'Ferry' } }])
  })

  it('adds a category through a link as the chosen member', async () => {
    const requests: ApiRequest[] = []
    const api = groupsApi(
      createApiClient(async (request) => {
        requests.push(request)
        return { id: 'gcat_ferry', standard: false, name: 'Ferry' }
      }),
    )

    await api.addCategory(linkScope('albania-2026-demo-link-0123456789abcdefghij', 'gmb_olya'), { name: 'Ferry' })

    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/v1/shared/groups/albania-2026-demo-link-0123456789abcdefghij/categories',
        body: { name: 'Ferry' },
        headers: { 'X-Group-Member': 'gmb_olya' },
      },
    ])
  })

  it('reads a group through a link without naming a member', async () => {
    const requests: ApiRequest[] = []
    const api = groupsApi(
      createApiClient(async (request) => {
        requests.push(request)
        return {}
      }),
    )

    await api.get(linkScope('albania-2026-demo-link-0123456789abcdefghij', 'gmb_olya'))

    expect(requests).toEqual([{ method: 'GET', path: '/v1/shared/groups/albania-2026-demo-link-0123456789abcdefghij' }])
  })

  it('turns the share link on and off below the group', async () => {
    const requests: ApiRequest[] = []
    const group: GroupDto = {
      id: 'grp/albania',
      name: 'Albania 2026',
      currency: 'EUR',
      currencyLocked: true,
      total: 19070,
      members: [],
      categories: [],
      shareToken: 'albania-2026-demo-link-0123456789abcdefghij',
      role: 'owner',
      myMemberId: null,
    }
    const api = groupsApi(
      createApiClient(async (request) => {
        requests.push(request)
        return request.method === 'POST' ? group : undefined
      }),
    )

    expect(await api.share('grp/albania')).toEqual(group)
    await api.unshare('grp/albania')

    expect(requests).toEqual([
      { method: 'POST', path: '/v1/groups/grp%2Falbania/share' },
      { method: 'DELETE', path: '/v1/groups/grp%2Falbania/share' },
    ])
  })

  it('links and unlinks a member below the member path', async () => {
    const requests: ApiRequest[] = []
    const member: GroupMemberDto = {
      id: 'gmb/anna',
      name: 'Anna',
      inUse: true,
      linked: true,
      linkedName: 'Anna Nowak',
      invitedEmail: null,
    }
    const api = groupsApi(
      createApiClient(async (request) => {
        requests.push(request)
        return request.method === 'PUT' ? member : undefined
      }),
    )

    expect(await api.linkMe('grp/albania', 'gmb/anna')).toEqual(member)
    await api.unlinkMember('grp/albania', 'gmb/anna')

    expect(requests).toEqual([
      { method: 'PUT', path: '/v1/groups/grp%2Falbania/members/gmb%2Fanna/link' },
      { method: 'DELETE', path: '/v1/groups/grp%2Falbania/members/gmb%2Fanna/link' },
    ])
  })

  it('sends and cancels an invitation below the member path', async () => {
    const requests: ApiRequest[] = []
    const member: GroupMemberDto = {
      id: 'gmb/olya',
      name: 'Olya',
      inUse: false,
      linked: false,
      linkedName: null,
      invitedEmail: 'olya@example.com',
    }
    const api = groupsApi(
      createApiClient(async (request) => {
        requests.push(request)
        return request.method === 'PUT' ? member : undefined
      }),
    )

    expect(await api.invite('grp/albania', 'gmb/olya', { email: 'olya@example.com' })).toEqual(member)
    await api.cancelInvite('grp/albania', 'gmb/olya')

    expect(requests).toEqual([
      {
        method: 'PUT',
        path: '/v1/groups/grp%2Falbania/members/gmb%2Folya/invite',
        body: { email: 'olya@example.com' },
      },
      { method: 'DELETE', path: '/v1/groups/grp%2Falbania/members/gmb%2Folya/invite' },
    ])
  })

  it('lists, accepts and declines the invitations of the signed-in user', async () => {
    const requests: ApiRequest[] = []
    const summary: GroupSummaryDto = {
      id: 'grp_krakow',
      name: 'Kraków',
      currency: 'PLN',
      members: 3,
      total: 30000,
      role: 'member',
    }
    const api = groupsApi(
      createApiClient(async (request) => {
        requests.push(request)
        if (request.method === 'GET') return { items: [], page: 1, pageSize: 100, total: 0 }
        return request.path.endsWith('/accept') ? summary : undefined
      }),
    )

    await api.invites()
    expect(await api.acceptInvite('gmb/anna')).toEqual(summary)
    await api.declineInvite('gmb/anna')

    expect(requests).toEqual([
      { method: 'GET', path: '/v1/group-invites', query: { pageSize: 100 } },
      { method: 'POST', path: '/v1/group-invites/gmb%2Fanna/accept' },
      { method: 'POST', path: '/v1/group-invites/gmb%2Fanna/decline' },
    ])
  })

  it('leaves a group through the membership of the signed-in user', async () => {
    const requests: ApiRequest[] = []
    const api = groupsApi(
      createApiClient(async (request) => {
        requests.push(request)
        return undefined
      }),
    )

    await api.leave('grp/krakow')

    expect(requests).toEqual([{ method: 'DELETE', path: '/v1/groups/grp%2Fkrakow/membership' }])
  })

  it('links the picked member through the share link with the member header and no body', async () => {
    const requests: ApiRequest[] = []
    const summary: GroupSummaryDto = {
      id: 'grp_albania',
      name: 'Albania 2026',
      currency: 'EUR',
      members: 4,
      total: 0,
      role: 'owner',
    }
    const api = groupsApi(
      createApiClient(async (request) => {
        requests.push(request)
        return summary
      }),
    )

    expect(await api.linkThroughShare('albania-2026-demo-link-0123456789abcdefghij', 'gmb_olya')).toEqual(summary)

    expect(requests).toEqual([
      {
        method: 'PUT',
        path: '/v1/shared/groups/albania-2026-demo-link-0123456789abcdefghij/membership',
        body: undefined,
        headers: { 'X-Group-Member': 'gmb_olya' },
      },
    ])
  })
})
