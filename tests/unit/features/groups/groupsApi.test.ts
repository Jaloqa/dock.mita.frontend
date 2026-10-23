import { describe, expect, it } from 'bun:test'
import { groupsApi } from '../../../../app/features/groups/api/groupsApi'
import { linkScope, ownerScope } from '../../../../app/features/groups/utils/scope'
import { createApiClient } from '../../../../app/shared/api/client'
import type { GroupDto } from '../../../../app/shared/api/contract'
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

    await api.addCategory(ownerScope('grp/albania'), { name: 'Ferry' })

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
})
