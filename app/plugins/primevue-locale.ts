import { capitalizeFirst } from '~/shared/utils/text'

const names = (locale: string, count: number, at: (index: number) => Date, options: Intl.DateTimeFormatOptions) => {
  const format = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
  return Array.from({ length: count }, (_, index) => capitalizeFirst(format.format(at(index)), locale))
}

const weekday = (index: number) => new Date(Date.UTC(2023, 0, 1 + index))
const month = (index: number) => new Date(Date.UTC(2023, index, 1))

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = nuxtApp.$i18n
  const primevue = nuxtApp.vueApp.config.globalProperties.$primevue

  const apply = () => {
    const locale = i18n.locale.value
    const t = (key: string) => i18n.t(`shared.primevue.${key}`, ['{0}'])
    const target = primevue.config.locale
    if (!target) return
    Object.assign(target, {
      dayNames: names(locale, 7, weekday, { weekday: 'long' }),
      dayNamesShort: names(locale, 7, weekday, { weekday: 'short' }),
      dayNamesMin: names(locale, 7, weekday, { weekday: 'short' }).map((name) => name.replace(/\.$/, '')),
      monthNames: names(locale, 12, month, { month: 'long' }),
      monthNamesShort: names(locale, 12, month, { month: 'short' }),
      firstDayOfWeek: Number(t('firstDayOfWeek')),
      dateFormat: i18n.t('shared.dateInputFormat'),
      today: t('today'),
      clear: t('clear'),
      accept: t('accept'),
      reject: t('reject'),
      weekHeader: t('weekHeader'),
      chooseDate: t('chooseDate'),
      chooseMonth: t('chooseMonth'),
      chooseYear: t('chooseYear'),
      prevMonth: t('prevMonth'),
      nextMonth: t('nextMonth'),
      prevYear: t('prevYear'),
      nextYear: t('nextYear'),
      prevDecade: t('prevDecade'),
      nextDecade: t('nextDecade'),
      emptyMessage: t('emptyMessage'),
      emptyFilterMessage: t('emptyFilterMessage'),
      emptySearchMessage: t('emptyFilterMessage'),
      emptySelectionMessage: t('emptySelectionMessage'),
      searchMessage: t('searchMessage'),
      selectionMessage: t('selectionMessage'),
      aria: { ...target.aria, close: t('close') },
    })
  }

  watch(i18n.locale, apply, { immediate: true })
})
