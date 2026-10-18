import type { Locale } from '../../app/shared/api/contract'
import type { SettingsRow, UserRow } from '../db'

export const demoUsers = (): UserRow[] => [
  { id: 'usr_anna', name: 'Anna Nowak', email: 'anna@demo.mita.app', createdAt: '2026-04-01T09:00:00Z' },
  { id: 'usr_oleh', name: 'Oleh Kravets', email: 'oleh@demo.mita.app', createdAt: '2026-05-12T18:30:00Z' },
]

export const defaultSettings = (userId: string, locale: Locale): SettingsRow => ({
  userId,
  baseCurrency: 'PLN',
  locale,
  monthStartDay: 1,
  theme: 'system',
  notifications: { budgetLimit: true, dailyReminder: true, weeklyReport: false, goals: true },
})

export const demoSettings = (): SettingsRow[] => [
  {
    userId: 'usr_anna',
    baseCurrency: 'PLN',
    locale: 'pl',
    monthStartDay: 1,
    theme: 'system',
    notifications: { budgetLimit: true, dailyReminder: true, weeklyReport: false, goals: true },
  },
  {
    userId: 'usr_oleh',
    baseCurrency: 'UAH',
    locale: 'uk',
    monthStartDay: 10,
    theme: 'dark',
    notifications: { budgetLimit: true, dailyReminder: false, weeklyReport: true, goals: false },
  },
]
