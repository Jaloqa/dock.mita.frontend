import { describe, expect, it } from 'bun:test'
import type { Page, TagDto, TransactionDto } from '../../../app/shared/api/contract'
import type { MockApi } from '../../../mocks/api'
import { tagRefs, tagsError, tagUsage, upsertTags } from '../../../mocks/tags'
import { loggedInMockApi } from './session'

const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)
const field = (name: string, code: string) => ({ problem: { status: 400, errors: { [name]: [code] } } })

const list = (mock: MockApi, query?: Record<string, string>) =>
  mock.handle({ method: 'GET', path: '/v1/tags', query }) as Promise<Page<TagDto>>
const rename = (mock: MockApi, id: string, body: unknown) =>
  mock.handle({ method: 'PUT', path: `/v1/tags/${id}`, body }) as Promise<TagDto>

describe('tags', () => {
  it('lists the seed tags of the user in name order with their usage', async () => {
    const page = await list(loggedInMockApi())
    expect(page.items.map((tag) => tag.name)).toEqual(['abonament', 'barcelona', 'praca', 'remont'])
    expect(page).toMatchObject({ page: 1, pageSize: 100, total: 4 })
    const usage = Object.fromEntries(page.items.map((tag) => [tag.name, tag.usage]))
    expect(usage.abonament).toBeGreaterThanOrEqual(3)
    expect(usage.praca).toBeGreaterThanOrEqual(2)
    expect(usage.barcelona).toBe(1)
    expect(usage.remont).toBe(0)
    expect(Object.keys(page.items[0] ?? {}).sort()).toEqual(['id', 'name', 'usage'])
  })

  it('gives another user no tags', async () => {
    expect((await list(loggedInMockApi('usr_oleh'))).items).toEqual([])
  })

  it('searches names as case-insensitive literal text and pages with validation', async () => {
    const mock = loggedInMockApi()
    expect((await list(mock, { search: ' BAR ' })).items.map((tag) => tag.name)).toEqual(['barcelona'])
    expect((await list(mock, { search: '%' })).items).toEqual([])
    expect((await list(mock, { page: '2', pageSize: '3' })).items.map((tag) => tag.name)).toEqual(['remont'])
    expect(await failure(list(mock, { pageSize: '101' }))).toMatchObject(field('pageSize', 'validation.invalidValue'))
    expect(await failure(list(mock, { page: '0' }))).toMatchObject(field('page', 'validation.invalidValue'))
  })

  it('renames a tag, trims the name and allows changing only its case', async () => {
    const mock = loggedInMockApi()
    expect(await rename(mock, 'tag_anna_praca', { name: '  Praca ' })).toEqual({
      id: 'tag_anna_praca',
      name: 'Praca',
      usage: expect.any(Number),
    })
    expect((await list(mock)).items.map((tag) => tag.name)).toContain('Praca')
  })

  it('refuses a name another tag has, whatever its case', async () => {
    const mock = loggedInMockApi()
    expect(await failure(rename(mock, 'tag_anna_abonament', { name: ' PRACA ' }))).toMatchObject(
      field('name', 'validation.tagNameTaken'),
    )
  })

  it('validates the new name in order', async () => {
    const mock = loggedInMockApi()
    for (const body of [{}, { name: null }, { name: '   ' }]) {
      expect(await failure(rename(mock, 'tag_anna_praca', body))).toMatchObject(field('name', 'validation.required'))
    }
    for (const name of [1, true, ['a'], 'a\tb']) {
      expect(await failure(rename(mock, 'tag_anna_praca', { name }))).toMatchObject(
        field('name', 'validation.invalidValue'),
      )
    }
    expect(await failure(rename(mock, 'tag_anna_praca', { name: 'x'.repeat(31) }))).toMatchObject(
      field('name', 'validation.tagTooLong'),
    )
    expect(await rename(mock, 'tag_anna_praca', { name: 'x'.repeat(30) })).toMatchObject({ name: 'x'.repeat(30) })
  })

  it('deletes a tag and removes it from every transaction', async () => {
    const mock = loggedInMockApi()
    expect(await mock.handle({ method: 'DELETE', path: '/v1/tags/tag_anna_abonament' })).toBeUndefined()
    expect((await list(mock)).items.map((tag) => tag.name)).toEqual(['barcelona', 'praca', 'remont'])
    expect(mock.db.state.transactions.some((row) => row.tagIds.includes('tag_anna_abonament'))).toBe(false)
    expect(mock.db.state.transactions.some((row) => row.tagIds.includes('tag_anna_praca'))).toBe(true)
  })

  it('answers 404 for an unknown or foreign tag and validates before looking up', async () => {
    const mock = loggedInMockApi('usr_oleh')
    for (const method of ['PUT', 'DELETE'] as const) {
      expect(
        await failure(mock.handle({ method, path: '/v1/tags/tag_anna_praca', body: { name: 'ok' } })),
      ).toMatchObject({ problem: { status: 404 } })
    }
    expect(
      await failure(mock.handle({ method: 'PUT', path: '/v1/tags/tag_missing', body: { name: 'ok' } })),
    ).toMatchObject({ problem: { status: 404 } })
    expect(await failure(rename(mock, 'tag_anna_praca', {}))).toMatchObject(field('name', 'validation.required'))
    expect(mock.db.state.tags.some((tag) => tag.id === 'tag_anna_praca')).toBe(true)
  })

  it('shows renamed tags on transactions', async () => {
    const mock = loggedInMockApi()
    await rename(mock, 'tag_anna_barcelona', { name: 'Barcelona 2026' })
    const page = (await mock.handle({
      method: 'GET',
      path: '/v1/transactions',
      query: { tagIds: 'tag_anna_barcelona' },
    })) as Page<TransactionDto>
    expect(page.items.map((item) => item.tags)).toEqual([[{ id: 'tag_anna_barcelona', name: 'Barcelona 2026' }]])
  })
})

describe('tag helpers', () => {
  it('reports the first failing rule', () => {
    expect(tagsError(undefined)).toBeUndefined()
    expect(tagsError(null)).toBeUndefined()
    expect(tagsError([])).toBeUndefined()
    expect(tagsError('a')).toBe('validation.invalidValue')
    expect(tagsError([' '])).toBe('validation.invalidValue')
    expect(tagsError(['x'.repeat(31), 3])).toBe('validation.invalidValue')
    expect(tagsError(['x'.repeat(31)])).toBe('validation.tagTooLong')
    expect(tagsError(Array.from({ length: 11 }, (_, index) => `t${index}`))).toBe('validation.tooManyTags')
    expect(tagsError(['a', 'A', ' a '])).toBeUndefined()
  })

  it('upserts by name case-insensitively and sorts references', () => {
    const state = loggedInMockApi().db.state
    const ids = upsertTags(state, 'usr_anna', ['PRACA', 'zeta', 'Alfa'])
    expect(ids[0]).toBe('tag_anna_praca')
    expect(state.tags.filter((tag) => tag.name === 'praca')).toHaveLength(1)
    expect(tagRefs(state, ids).map((tag) => tag.name)).toEqual(['Alfa', 'praca', 'zeta'])
    expect(state.tags.find((tag) => tag.name === 'zeta')?.id).toStartWith('tag_')
    expect(upsertTags(state, 'usr_oleh', ['praca'])[0]).not.toBe('tag_anna_praca')
    expect(tagUsage(state, 'usr_anna').get('tag_anna_remont')).toBeUndefined()
  })
})
