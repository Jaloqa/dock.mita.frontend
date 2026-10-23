import { describe, expect, it } from 'bun:test'
import { createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { provideGroupScope, useGroupScope } from '../../../../app/features/groups/composables/useGroupScope'
import { type GroupScope, ownerScope } from '../../../../app/features/groups/utils/scope'

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
        provideGroupScope(() => ownerScope(groupId.value))
        return () => h(Child)
      },
    })

    await renderToString(createSSRApp(Parent))

    expect(seen).toEqual([ownerScope('grp_albania'), ownerScope('grp_rome')])
  })
})
