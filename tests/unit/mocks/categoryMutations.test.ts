import { afterEach, describe, expect, it } from 'bun:test'
import type { CategoryDto, CategoryInput, Page } from '../../../app/shared/api/contract'
import type { MockApi } from '../../../mocks/api'
import { type CategoryReference, categoryReferences } from '../../../mocks/categories'
import { loggedInMockApi } from './session'

const api = () => loggedInMockApi()
const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)
const list = async (mock: MockApi) =>
  ((await mock.handle({ method: 'GET', path: '/v1/categories' })) as Page<CategoryDto>).items
const create = (mock: MockApi, body: unknown) => mock.handle({ method: 'POST', path: '/v1/categories', body })
const update = (mock: MockApi, id: string, body: unknown) =>
  mock.handle({ method: 'PUT', path: `/v1/categories/${id}`, body })
const remove = (mock: MockApi, id: string) => mock.handle({ method: 'DELETE', path: `/v1/categories/${id}` })
const fieldError = (field: string, code: string) => ({ problem: { status: 400, errors: { [field]: [code] } } })

const books: CategoryInput = { name: 'Książki', kind: 'expense', color: 'chart-4' }

const usage = (assignments: Record<string, { userId: string; categoryId: string }>): CategoryReference => ({
  usedCategoryIds: (_state, userId) =>
    new Set(
      Object.values(assignments)
        .filter((assignment) => assignment.userId === userId)
        .map((assignment) => assignment.categoryId),
    ),
  reassign: (_state, userId, fromId, toId) => {
    for (const assignment of Object.values(assignments)) {
      if (assignment.userId === userId && assignment.categoryId === fromId) assignment.categoryId = toId
    }
  },
})

const registered: CategoryReference[] = []
const register = (reference: CategoryReference) => {
  categoryReferences.push(reference)
  registered.push(reference)
}

afterEach(() => {
  for (const reference of registered.splice(0)) categoryReferences.splice(categoryReferences.indexOf(reference), 1)
})

describe('category mutations', () => {
  it('creates a category before the system ones of its kind', async () => {
    const mock = api()
    const created = (await create(mock, { ...books, name: '  Książki  ' })) as CategoryDto
    expect(created).toMatchObject({ name: 'Książki', kind: 'expense', color: 'chart-4', system: null, inUse: false })
    expect(created.id).toStartWith('cat_')
    const expense = (await list(mock))
      .filter((category) => category.kind === 'expense')
      .map((category) => category.name)
    expect(expense.slice(-4)).toEqual(['Sport', 'Książki', 'Inne', 'Przelewy'])
  })

  it('validates name, kind and colour', async () => {
    const mock = api()
    expect(await failure(create(mock, {}))).toMatchObject({
      problem: {
        status: 400,
        errors: { name: ['validation.required'], kind: ['validation.required'], color: ['validation.required'] },
      },
    })
    expect(await failure(create(mock, { ...books, name: '   ' }))).toMatchObject(
      fieldError('name', 'validation.required'),
    )
    expect(await failure(create(mock, { ...books, name: 42 }))).toMatchObject(
      fieldError('name', 'validation.invalidValue'),
    )
    expect(await failure(create(mock, { ...books, name: 'x'.repeat(41) }))).toMatchObject(
      fieldError('name', 'validation.nameTooLong'),
    )
    expect(await create(mock, { ...books, name: 'y'.repeat(40) })).toMatchObject({ name: 'y'.repeat(40) })
    expect(await failure(create(mock, { ...books, kind: 'transfer' }))).toMatchObject(
      fieldError('kind', 'validation.invalidValue'),
    )
    expect(await failure(create(mock, { ...books, color: '#ff0000' }))).toMatchObject(
      fieldError('color', 'validation.invalidValue'),
    )
  })

  it('keeps names unique per kind, ignoring case and surrounding spaces', async () => {
    const mock = api()
    expect(await failure(create(mock, { ...books, name: ' spożywcze ' }))).toMatchObject(
      fieldError('name', 'validation.categoryNameTaken'),
    )
    expect(await create(mock, { ...books, kind: 'income', name: 'Spożywcze' })).toMatchObject({ kind: 'income' })
    expect(await failure(update(mock, 'cat_anna_expense_sport', { ...books, name: 'INNE' }))).toMatchObject(
      fieldError('name', 'validation.categoryNameTaken'),
    )
    expect(await update(mock, 'cat_anna_expense_sport', { ...books, name: 'SPORT' })).toMatchObject({ name: 'SPORT' })
  })

  it('renames and recolours a system category but never changes its kind', async () => {
    const mock = api()
    const id = 'cat_anna_expense_other'
    expect(await update(mock, id, { name: 'Różne', kind: 'expense', color: 'chart-1' })).toMatchObject({
      name: 'Różne',
      color: 'chart-1',
      system: 'other',
    })
    expect(await failure(update(mock, id, { name: 'Różne', kind: 'income', color: 'chart-1' }))).toMatchObject(
      fieldError('kind', 'validation.categoryKindLocked'),
    )
  })

  it('changes the kind of a user category only while it is unused', async () => {
    const mock = api()
    const created = (await create(mock, books)) as CategoryDto
    expect(await update(mock, created.id, { ...books, kind: 'income' })).toMatchObject({ kind: 'income' })
    register(usage({ tx1: { userId: 'usr_anna', categoryId: 'cat_anna_expense_gifts' } }))
    expect(
      await failure(update(mock, 'cat_anna_expense_gifts', { name: 'Prezenty', kind: 'income', color: 'chart-2' })),
    ).toMatchObject(fieldError('kind', 'validation.categoryKindLocked'))
  })

  it('reports categories in use', async () => {
    const mock = api()
    register(usage({ tx1: { userId: 'usr_anna', categoryId: 'cat_anna_expense_cafes' } }))
    const cafes = (await list(mock)).find((category) => category.id === 'cat_anna_expense_cafes')
    expect(cafes?.inUse).toBe(true)
  })

  it('deletes an unused category', async () => {
    const mock = api()
    const created = (await create(mock, books)) as CategoryDto
    expect(await remove(mock, created.id)).toBeUndefined()
    expect((await list(mock)).some((category) => category.id === created.id)).toBe(false)
  })

  it('moves references of a deleted category to the other category of the same kind and user', async () => {
    const mock = api()
    const assignments = {
      annaExpense: { userId: 'usr_anna', categoryId: 'cat_anna_expense_cafes' },
      annaIncome: { userId: 'usr_anna', categoryId: 'cat_anna_income_bonus' },
      oleh: { userId: 'usr_oleh', categoryId: 'cat_oleh_expense_cafes' },
    }
    register(usage(assignments))
    await remove(mock, 'cat_anna_expense_cafes')
    await remove(mock, 'cat_anna_income_bonus')
    expect(assignments.annaExpense.categoryId).toBe('cat_anna_expense_other')
    expect(assignments.annaIncome.categoryId).toBe('cat_anna_income_other')
    expect(assignments.oleh.categoryId).toBe('cat_oleh_expense_cafes')
  })

  it('refuses to delete system categories', async () => {
    const mock = api()
    for (const id of ['cat_anna_expense_other', 'cat_anna_expense_transfer', 'cat_anna_income_other']) {
      expect(await failure(remove(mock, id))).toMatchObject(fieldError('id', 'validation.systemCategory'))
    }
  })

  it('returns 404 for categories of another user or unknown ids', async () => {
    const mock = api()
    const notFound = { problem: { status: 404 } }
    expect(await failure(update(mock, 'cat_oleh_expense_cafes', books))).toMatchObject(notFound)
    expect(await failure(remove(mock, 'cat_oleh_expense_cafes'))).toMatchObject(notFound)
    expect(await failure(remove(mock, 'cat_missing'))).toMatchObject(notFound)
  })
})
