import type { CategoryKind } from '../../app/shared/api/contract'
import type { Currency } from '../../app/shared/money/money'
import { addDaysIso } from '../../app/shared/period/period'
import type { AccountRow, RateRow, SettingsRow, TransactionRow } from '../db'
import { priceTransaction } from '../transactions'

export const TRANSACTION_HISTORY_DAYS = 182

type Planned = {
  kind: CategoryKind
  title: string
  category: string
  account: string
  amount: number
  currency?: Currency
  note?: string
  tags?: string[]
}

type Extra = Pick<Planned, 'currency' | 'note' | 'tags'>

type Day = {
  daysAgo: number
  dayOfMonth: number
  month: number
  weekday: number
  chance(probability: number): boolean
  between(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

const hash = (text: string): number => {
  let value = 2_166_136_261
  for (const char of text) value = Math.imul(value ^ (char.codePointAt(0) ?? 0), 16_777_619)
  return value >>> 0
}

const generator = (seed: number) => {
  let state = seed
  return (): number => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

function dayOf(userId: string, iso: string, daysAgo: number): Day {
  const random = generator(hash(`${userId}:${iso}`))
  return {
    daysAgo,
    dayOfMonth: Number(iso.slice(8, 10)),
    month: Number(iso.slice(5, 7)),
    weekday: new Date(`${iso}T00:00:00Z`).getUTCDay(),
    chance: (probability) => random() < probability,
    between: (min, max) => Math.round((min + random() * (max - min)) / 10) * 10,
    pick: <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T,
  }
}

const expense = (title: string, category: string, account: string, amount: number, extra: Extra = {}): Planned => ({
  kind: 'expense',
  title,
  category,
  account,
  amount,
  ...extra,
})

const income = (title: string, category: string, account: string, amount: number, extra: Extra = {}): Planned => ({
  kind: 'income',
  title,
  category,
  account,
  amount,
  ...extra,
})

const abonament = 'tag_anna_abonament'
const praca = 'tag_anna_praca'
const barcelona = 'tag_anna_barcelona'

function annaDay(day: Day): Planned[] {
  const card = 'acc_anna_card'
  const cash = 'acc_anna_cash'
  const eur = 'acc_anna_eur'
  const items: Planned[] = []
  const date = day.dayOfMonth
  if (date === 1) items.push(expense('Karnet na siłownię', 'sport', card, 12_900, { tags: [abonament] }))
  if (date === 2) items.push(expense('Internet UPC', 'housing', card, 5_900, { tags: [abonament] }))
  if (date === 3 && day.month % 2 === 0)
    items.push(income('Zlecenie — projekt logo', 'freelance', card, 80_000, { tags: [praca] }))
  if (date === 5) items.push(expense('Czynsz', 'housing', card, 210_000))
  if (date === 8) items.push(expense('Steam', 'leisure', card, 1_999, { currency: 'EUR' }))
  if (date === 10) items.push(income('Wynagrodzenie', 'salary', card, 740_000))
  if (date === 12) items.push(expense('Apteka', 'health', cash, day.between(2_500, 6_000)))
  if (date === 14) items.push(expense('Bilet miesięczny MZK', 'transport', card, 9_200))
  if (date === 17) items.push(expense('Rossmann', 'shopping', card, day.between(4_000, 12_000)))
  if (date === 18) items.push(expense('Abonament Play', 'other', card, 5_900, { tags: [abonament] }))
  if (date === 19 && day.month % 2 === 1) items.push(expense('Dentysta', 'health', card, 35_000))
  if (date === 20) items.push(expense('Prąd — Tauron', 'housing', card, day.between(15_000, 21_000)))
  if (date === 22 && day.month % 2 === 1)
    items.push(expense('Prezent dla mamy', 'gifts', card, day.between(10_000, 20_000)))
  if (date === 24 && day.chance(0.6)) items.push(expense('Zalando', 'shopping', card, day.between(15_000, 35_000)))
  if (date === 26 && day.chance(0.3)) items.push(income('Zwrot — Zalando', 'refund', card, day.between(8_000, 15_000)))
  if (date === 28) items.push(income('Odsetki', 'interest', 'acc_anna_savings', day.between(2_400, 3_200)))
  if (day.weekday === 1 || day.weekday === 4)
    items.push(expense('Biedronka', 'groceries', card, day.between(6_000, 16_000)))
  if (day.weekday === 6) items.push(expense('Lidl', 'groceries', card, day.between(9_000, 22_000)))
  if (day.weekday === 6 && day.chance(0.5)) {
    items.push(expense('Restauracja Pod Aniołem', 'leisure', card, day.between(9_000, 16_000)))
  }
  if (day.chance(0.25)) items.push(expense('Żabka', 'groceries', cash, day.between(1_200, 3_500)))
  if (day.chance(0.2)) {
    const cafe = day.pick(['Starbucks', 'Costa Coffee', 'Kawiarnia Rozrusznik'])
    items.push(expense(cafe, 'cafes', day.chance(0.5) ? cash : card, day.between(1_400, 4_200)))
  }
  if (day.weekday === 5 && day.chance(0.5)) {
    items.push(expense(day.pick(['Kino Helios', 'Teatr Polski']), 'leisure', card, day.between(3_800, 9_000)))
  }
  if (day.chance(0.07)) items.push(expense('Bolt', 'transport', card, day.between(1_800, 4_500)))
  if (day.daysAgo === 118) {
    items.push(
      expense('Laptop — Media Expert', 'shopping', card, 429_900, { note: 'Nowy laptop do pracy', tags: [praca] }),
    )
  }
  if (day.daysAgo === 60)
    items.push(
      expense('Booking.com — hotel Barcelona', 'leisure', card, 42_000, { currency: 'EUR', tags: [barcelona] }),
    )
  if (day.daysAgo === 59) {
    items.push(expense('Ryanair', 'transport', card, 17_800, { currency: 'EUR', note: 'Kraków – Barcelona, 2 osoby' }))
  }
  if (day.daysAgo >= 45 && day.daysAgo <= 51) {
    items.push(expense('Mercadona', 'groceries', eur, day.between(1_500, 4_500)))
    items.push(
      expense(day.pick(['Tapas 24', 'Café de la Ópera', 'Bar Cañete']), 'cafes', eur, day.between(1_800, 5_500)),
    )
    if (day.chance(0.5)) items.push(expense('Metro Barcelona', 'transport', eur, 1_135))
  }
  return items
}

function olehDay(day: Day): Planned[] {
  const card = 'acc_oleh_card'
  const cash = 'acc_oleh_cash'
  const items: Planned[] = []
  const date = day.dayOfMonth
  if (date === 1) items.push(expense('Проїзний на метро', 'transport', card, 130_000))
  if (date === 3) items.push(expense('Київстар', 'other', card, 25_000))
  if (date === 5) items.push(expense('Оренда квартири', 'housing', card, 1_400_000))
  if (date === 7) items.push(expense('Комунальні послуги', 'housing', card, day.between(180_000, 260_000)))
  if (date === 10) items.push(income('Зарплата', 'salary', card, 3_200_000))
  if (date === 12) items.push(expense('Netflix', 'subscriptions', card, 999, { currency: 'USD' }))
  if (date === 16) items.push(expense('iCloud', 'subscriptions', card, 299, { currency: 'USD' }))
  if (date === 18) items.push(expense('Аптека АНЦ', 'health', card, day.between(30_000, 90_000)))
  if (date === 21) items.push(expense('Rozetka', 'shopping', card, day.between(80_000, 300_000)))
  if (date === 25 && day.month % 3 === 0) {
    items.push(income('Фриланс — Upwork', 'freelance', card, 45_000, { currency: 'USD' }))
  }
  if (date === 28) items.push(income('Відсотки по депозиту', 'interest', 'acc_oleh_usd', day.between(250, 400)))
  if (day.weekday === 2 || day.weekday === 6)
    items.push(expense('Сільпо', 'groceries', card, day.between(60_000, 180_000)))
  if (day.weekday === 4) items.push(expense('АТБ', 'groceries', card, day.between(30_000, 90_000)))
  if (day.chance(0.1)) items.push(expense('Novus', 'groceries', cash, day.between(20_000, 60_000)))
  if (day.chance(0.3)) items.push(expense('Aroma Kava', 'cafes', cash, day.between(7_000, 16_000)))
  if (day.chance(0.1)) items.push(expense('Львівські круасани', 'cafes', card, day.between(15_000, 32_000)))
  if (day.chance(0.2)) items.push(expense('Uklon', 'transport', card, day.between(12_000, 35_000)))
  if (day.weekday === 6 && day.chance(0.4)) {
    const place = day.pick(['Multiplex', 'Планета Кіно', 'Концерт у Docker Pub'])
    items.push(expense(place, 'leisure', card, day.between(25_000, 60_000)))
  }
  if (day.daysAgo === 96) items.push(expense('Подарунок сестрі', 'gifts', card, 250_000, { note: 'День народження' }))
  return items
}

const planners = [
  { userId: 'usr_anna', short: 'anna', plan: annaDay },
  { userId: 'usr_oleh', short: 'oleh', plan: olehDay },
] as const

export function demoTransactions(
  today: string,
  accounts: readonly AccountRow[],
  rates: readonly RateRow[],
  settings: readonly SettingsRow[],
): TransactionRow[] {
  const rows: TransactionRow[] = []
  const counters = new Map<string, number>()
  for (let daysAgo = TRANSACTION_HISTORY_DAYS; daysAgo >= 0; daysAgo -= 1) {
    const date = addDaysIso(today, -daysAgo)
    for (const planner of planners) {
      const baseCurrency = settings.find((row) => row.userId === planner.userId)?.baseCurrency ?? 'PLN'
      for (const planned of planner.plan(dayOf(planner.userId, date, daysAgo))) {
        const account = accounts.find((row) => row.id === planned.account)
        if (!account) throw new Error(`Unknown seed account ${planned.account}`)
        const currency = planned.currency ?? account.currency
        const number = (counters.get(planner.short) ?? 0) + 1
        counters.set(planner.short, number)
        rows.push({
          id: `txn_seed_${planner.short}_${number}`,
          userId: planner.userId,
          kind: planned.kind,
          date,
          title: planned.title,
          note: planned.note ?? null,
          tagIds: planned.tags ?? [],
          categoryId: `cat_${planner.short}_${planned.kind}_${planned.category}`,
          accountId: account.id,
          amount: planned.amount,
          currency,
          ...priceTransaction(rates, {
            date,
            amount: planned.amount,
            currency,
            accountCurrency: account.currency,
            baseCurrency,
          }),
        })
      }
    }
  }
  return rows
}

export const withTransactionHistory = (
  accounts: readonly AccountRow[],
  transactions: readonly TransactionRow[],
): AccountRow[] =>
  accounts.map((account) => ({
    ...account,
    openingBalance: transactions
      .filter((row) => row.accountId === account.id)
      .reduce(
        (opening, row) => opening - (row.kind === 'income' ? row.accountAmount : -row.accountAmount),
        account.openingBalance,
      ),
  }))
