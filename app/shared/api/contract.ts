import type { Currency } from '../money/money'
import type { MonthStart } from '../period/period'

export type Locale = 'en' | 'pl' | 'ru' | 'uk'

export const locales: readonly Locale[] = ['en', 'pl', 'ru', 'uk']

export type ThemePreference = 'system' | 'light' | 'dark'

export const themePreferences: readonly ThemePreference[] = ['system', 'light', 'dark']

export type NotificationPrefs = {
  budgetLimit: boolean
  dailyReminder: boolean
  weeklyReport: boolean
  goals: boolean
}

export type UserDto = { id: string; name: string; email: string; createdAt: string }

export type SettingsDto = {
  baseCurrency: Currency
  locale: Locale
  monthStartDay: MonthStart
  theme: ThemePreference
  notifications: NotificationPrefs
}

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number }

export type DemoStateDto = {
  activeUserId: string
  users: { id: string; name: string }[]
  simulateErrors: boolean
}

export type AccountType = 'card' | 'cash' | 'savings'

export const accountTypes: readonly AccountType[] = ['card', 'cash', 'savings']

export type AccountDto = {
  id: string
  name: string
  type: AccountType
  currency: Currency
  openingBalance: number
  balance: number
  cardLast4: string | null
  archived: boolean
  inUse: boolean
}

export type AccountInput = {
  name: string
  type: AccountType
  currency: Currency
  openingBalance: number
  cardLast4?: string | null
  archived?: boolean
}

export type TransferDto = {
  id: string
  date: string
  fromAccountId: string
  toAccountId: string
  fromAmount: number
  toAmount: number
  rate: number
  note: string | null
}

export type TransferInput = {
  date: string
  fromAccountId: string
  toAccountId: string
  fromAmount: number
  rate?: number
  note?: string
}

export type RateDto = { date: string; from: Currency; to: Currency; value: number }
