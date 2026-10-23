import { describe, expect, it } from 'bun:test'
import { createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import {
  provideGroupScope,
  useGroupScope,
  useMemberRefusal,
} from '../../../../app/features/groups/composables/useGroupScope'
import { type GroupScope, linkScope, userScope } from '../../../../app/features/groups/utils/scope'
import { ApiError } from '../../../../app/shared/api/problem'

const TOKEN = 'albania-2026-demo-link-0123456789abcdefghij'

describe('group scope', () => {
  it('throws when no parent provides one', () => {
    const app = createSSRApp({})
    expect(() => app.runWithContext(() => useGroupScope())).toThrow('provideGroupScope')
  })

  it('hands the provided scope to a descendant and follows a changing one', async () => {
    const groupId = ref('grp_albania')
    const seen: GroupScope[] = []
    const Child = defineComponent({
      setup() {
        const scope = useGroupScope()
        seen.push(scope.value)
        groupId.value = 'grp_rome'
        seen.push(scope.value)
        return () => h('div')
      },
    })
    const Parent = defineComponent({
      setup() {
        provideGroupScope(() => userScope(groupId.value))
        return () => h(Child)
      },
    })

    await renderToString(createSSRApp(Parent))

    expect(seen).toEqual([userScope('grp_albania'), userScope('grp_rome')])
  })

  it('reports a refused member to the page that provides the scope and nothing else', async () => {
    let refusals = 0
    const Child = defineComponent({
      setup() {
        const report = useMemberRefusal()
        report(new ApiError({ status: 403, title: 'Forbidden', code: 'group.memberRequired' }))
        report(new ApiError({ status: 403, title: 'Forbidden', code: 'auth.xsrf' }))
        report(new ApiError({ status: 404, title: 'Not Found' }))
        report(new Error('boom'))
        return () => h('div')
      },
    })
    const Parent = defineComponent({
      setup() {
        provideGroupScope(linkScope(TOKEN, 'gmb_olya'), () => {
          refusals += 1
        })
        return () => h(Child)
      },
    })

    await renderToString(createSSRApp(Parent))

    expect(refusals).toBe(1)
  })

  it('ignores a refused member when the scope comes without a handler', async () => {
    const Child = defineComponent({
      setup() {
        useMemberRefusal()(new ApiError({ status: 403, title: 'Forbidden', code: 'group.memberRequired' }))
        return () => h('div')
      },
    })
    const Parent = defineComponent({
      setup() {
        provideGroupScope(userScope('grp_albania'))
        return () => h(Child)
      },
    })

    expect(await renderToString(createSSRApp(Parent))).toBe('<div></div>')
  })
})
