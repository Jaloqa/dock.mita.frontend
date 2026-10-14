import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AppLogo from '~/shared/components/AppLogo.vue'

describe('AppLogo', () => {
  it('renders the wordmark by default', async () => {
    const wrapper = await mountSuspended(AppLogo)
    expect(wrapper.text()).toBe('Mita')
  })

  it('exposes an accessible name when shown without the wordmark', async () => {
    const wrapper = await mountSuspended(AppLogo, { props: { withWordmark: false } })
    expect(wrapper.find('svg').attributes('aria-label')).toBe('Mita')
  })
})
