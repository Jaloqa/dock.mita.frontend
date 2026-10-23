import { describe, expect, it } from 'bun:test'
import { groupsApi } from '../../../../app/features/groups/api/groupsApi'
import { ownerScope } from '../../../../app/features/groups/utils/scope'
import { createApiClient } from '../../../../app/shared/api/client'
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
})
