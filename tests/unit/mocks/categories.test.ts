import { describe, expect, it } from 'bun:test'
import { type CategoryDto, categoryColors, type Page } from '../../../app/shared/api/contract'
import { createMockApi, type MockApi } from '../../../mocks/api'
import { createDb, type KeyValueStorage, STORAGE_KEY } from '../../../mocks/db'
import { defaultHandlers } from '../../../mocks/handlers'
import { seedState } from '../../../mocks/seed'

const api = () => createMockApi({ register: defaultHandlers })
const failure = (promise: Promise<unknown>) => promise.catch((error: unknown) => error)
const list = async (mock: MockApi, query?: Record<string, string>) =>
  (await mock.handle({ method: 'GET', path: '/v1/categories', query })) as Page<CategoryDto>
const names = (page: Page<CategoryDto>, kind: CategoryDto['kind']) =>
  page.items.filter((category) => category.kind === kind).map((category) => category.name)

describe('categories', () => {
  it('lists the Polish categories of Anna, expenses first, system categories last', async () => {
    const page = await list(api())
    expect(page).toMatchObject({ page: 1, pageSize: 100, total: 19 })
    expect(names(page, 'expense')).toEqual([
      'Spożywcze',
      'Transport',
      'Mieszkanie',
      'Kawiarnie',
      'Zdrowie',
      'Zakupy',
      'Rozrywka',
      'Prezenty',
      'Sport',
      'Inne',
      'Przelewy',
    ])
    expect(names(page, 'income')).toEqual([
      'Wynagrodzenie',
      'Freelance',
      'Prezent',
      'Odsetki',
      'Zwrot',
      'Sprzedaż',
      'Premia',
      'Inne',
    ])
    expect(page.items.findIndex((category) => category.kind === 'income')).toBe(11)
  })

  it('marks exactly one other per kind and one transfer category as system', async () => {
    const system = (await list(api())).items
      .filter((category) => category.system !== null)
      .map((category) => [category.kind, category.system])
    expect(system).toEqual([
      ['expense', 'other'],
      ['expense', 'transfer'],
      ['income', 'other'],
    ])
  })

  it('shows Oleh his own Ukrainian categories only', async () => {
    const mock = api()
    const anna = new Set((await list(mock)).items.map((category) => category.id))
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_oleh' } })
    const oleh = await list(mock)
    expect(oleh.items.some((category) => anna.has(category.id))).toBe(false)
    expect(names(oleh, 'expense')).toEqual([
      'Продукти',
      'Транспорт',
      'Житло',
      'Кафе',
      "Здоров'я",
      'Покупки',
      'Дозвілля',
      'Подарунки',
      'Підписки',
      'Інше',
      'Перекази',
    ])
    expect(names(oleh, 'income')).toContain('Зарплата')
  })

  it('uses chart token keys as colours', async () => {
    for (const category of seedState().categories) expect(categoryColors).toContain(category.color)
  })

  it('never exposes userId', async () => {
    const [category] = (await list(api())).items
    expect(Object.keys(category ?? {}).sort()).toEqual(['color', 'id', 'inUse', 'kind', 'name', 'system'])
    expect(category).toMatchObject({ inUse: false })
  })

  it('filters by kind and rejects an unknown kind', async () => {
    const mock = api()
    const income = await list(mock, { kind: 'income' })
    expect(income.total).toBe(8)
    expect(income.items.every((category) => category.kind === 'income')).toBe(true)
    expect(await failure(list(mock, { kind: 'transfer' }))).toMatchObject({
      problem: { status: 400, errors: { kind: ['validation.invalidValue'] } },
    })
  })

  it('gives a new user the starter set in their language exactly once', async () => {
    const mock = api()
    mock.db.state.users.push({
      id: 'usr_new',
      name: 'New',
      email: 'new@demo.mita.app',
      createdAt: '2026-10-01T00:00:00Z',
    })
    const anna = mock.db.state.settings.find((row) => row.userId === 'usr_anna')
    if (!anna) throw new Error('seed has no settings for Anna')
    mock.db.state.settings.push({ ...anna, userId: 'usr_new', locale: 'ru' })
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_new' } })
    const first = await list(mock)
    expect(names(first, 'expense')).toEqual([
      'Продукты',
      'Транспорт',
      'Жильё',
      'Кафе',
      'Здоровье',
      'Покупки',
      'Досуг',
      'Подарки',
      'Другое',
      'Переводы',
    ])
    expect(names(first, 'income')).toEqual([
      'Зарплата',
      'Фриланс',
      'Подарок',
      'Проценты',
      'Возврат',
      'Продажа',
      'Бонус',
      'Другое',
    ])
    expect(first.items.every((category) => category.id.startsWith('cat_'))).toBe(true)
    const second = await list(mock)
    expect(second.items.map((category) => category.id)).toEqual(first.items.map((category) => category.id))
  })

  it('gives a new user without settings the English starter set', async () => {
    const mock = api()
    mock.db.state.users.push({
      id: 'usr_bare',
      name: 'Bare',
      email: 'bare@demo.mita.app',
      createdAt: '2026-10-01T00:00:00Z',
    })
    await mock.handle({ method: 'POST', path: '/v1/demo/switch-user', body: { userId: 'usr_bare' } })
    expect(names(await list(mock), 'expense')[0]).toBe('Groceries')
  })

  it('starts from the seed when the stored database has no categories table', () => {
    const { categories: _categories, ...older } = seedState()
    const storage: KeyValueStorage = {
      getItem: (key) => (key === STORAGE_KEY ? JSON.stringify(older) : null),
      setItem: () => {},
    }
    expect(createDb(storage, seedState).state.categories.length).toBeGreaterThan(0)
  })
})
