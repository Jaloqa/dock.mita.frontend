import type { CategoryColor, CategoryKind, Locale, SystemCategory } from '../../app/shared/api/contract'
import type { CategoryRow } from '../db'

export type StarterCategory = {
  key: string
  kind: CategoryKind
  color: CategoryColor
  system: SystemCategory | null
  names: Record<Locale, string>
}

export const starterSet: readonly StarterCategory[] = [
  {
    key: 'groceries',
    kind: 'expense',
    color: 'chart-2',
    system: null,
    names: { en: 'Groceries', pl: 'Spożywcze', ru: 'Продукты', uk: 'Продукти' },
  },
  {
    key: 'transport',
    kind: 'expense',
    color: 'chart-5',
    system: null,
    names: { en: 'Transport', pl: 'Transport', ru: 'Транспорт', uk: 'Транспорт' },
  },
  {
    key: 'housing',
    kind: 'expense',
    color: 'chart-1',
    system: null,
    names: { en: 'Housing', pl: 'Mieszkanie', ru: 'Жильё', uk: 'Житло' },
  },
  {
    key: 'cafes',
    kind: 'expense',
    color: 'chart-4',
    system: null,
    names: { en: 'Cafes', pl: 'Kawiarnie', ru: 'Кафе', uk: 'Кафе' },
  },
  {
    key: 'health',
    kind: 'expense',
    color: 'chart-3',
    system: null,
    names: { en: 'Health', pl: 'Zdrowie', ru: 'Здоровье', uk: "Здоров'я" },
  },
  {
    key: 'shopping',
    kind: 'expense',
    color: 'chart-4',
    system: null,
    names: { en: 'Shopping', pl: 'Zakupy', ru: 'Покупки', uk: 'Покупки' },
  },
  {
    key: 'leisure',
    kind: 'expense',
    color: 'chart-3',
    system: null,
    names: { en: 'Leisure', pl: 'Rozrywka', ru: 'Досуг', uk: 'Дозвілля' },
  },
  {
    key: 'gifts',
    kind: 'expense',
    color: 'chart-2',
    system: null,
    names: { en: 'Gifts', pl: 'Prezenty', ru: 'Подарки', uk: 'Подарунки' },
  },
  {
    key: 'other',
    kind: 'expense',
    color: 'chart-6',
    system: 'other',
    names: { en: 'Other', pl: 'Inne', ru: 'Другое', uk: 'Інше' },
  },
  {
    key: 'transfer',
    kind: 'expense',
    color: 'chart-5',
    system: 'transfer',
    names: { en: 'Transfers', pl: 'Przelewy', ru: 'Переводы', uk: 'Перекази' },
  },
  {
    key: 'salary',
    kind: 'income',
    color: 'chart-2',
    system: null,
    names: { en: 'Salary', pl: 'Wynagrodzenie', ru: 'Зарплата', uk: 'Зарплата' },
  },
  {
    key: 'freelance',
    kind: 'income',
    color: 'chart-1',
    system: null,
    names: { en: 'Freelance', pl: 'Freelance', ru: 'Фриланс', uk: 'Фриланс' },
  },
  {
    key: 'gift',
    kind: 'income',
    color: 'chart-4',
    system: null,
    names: { en: 'Gift', pl: 'Prezent', ru: 'Подарок', uk: 'Подарунок' },
  },
  {
    key: 'interest',
    kind: 'income',
    color: 'chart-3',
    system: null,
    names: { en: 'Interest', pl: 'Odsetki', ru: 'Проценты', uk: 'Відсотки' },
  },
  {
    key: 'refund',
    kind: 'income',
    color: 'chart-5',
    system: null,
    names: { en: 'Refund', pl: 'Zwrot', ru: 'Возврат', uk: 'Повернення' },
  },
  {
    key: 'sale',
    kind: 'income',
    color: 'chart-1',
    system: null,
    names: { en: 'Sale', pl: 'Sprzedaż', ru: 'Продажа', uk: 'Продаж' },
  },
  {
    key: 'bonus',
    kind: 'income',
    color: 'chart-4',
    system: null,
    names: { en: 'Bonus', pl: 'Premia', ru: 'Бонус', uk: 'Бонус' },
  },
  {
    key: 'other',
    kind: 'income',
    color: 'chart-6',
    system: 'other',
    names: { en: 'Other', pl: 'Inne', ru: 'Другое', uk: 'Інше' },
  },
]

export function starterCategories(
  userId: string,
  locale: Locale,
  idOf: (starter: StarterCategory) => string,
): CategoryRow[] {
  return starterSet.map((starter) => ({
    id: idOf(starter),
    userId,
    name: starter.names[locale],
    kind: starter.kind,
    color: starter.color,
    system: starter.system,
  }))
}

const seededId =
  (user: string) =>
  (starter: StarterCategory): string =>
    `cat_${user}_${starter.kind}_${starter.key}`

export const demoCategories = (): CategoryRow[] => [
  ...starterCategories('usr_anna', 'pl', seededId('anna')),
  { id: 'cat_anna_expense_sport', userId: 'usr_anna', name: 'Sport', kind: 'expense', color: 'chart-3', system: null },
  ...starterCategories('usr_oleh', 'uk', seededId('oleh')),
  {
    id: 'cat_oleh_expense_subscriptions',
    userId: 'usr_oleh',
    name: 'Підписки',
    kind: 'expense',
    color: 'chart-4',
    system: null,
  },
]
