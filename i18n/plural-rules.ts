import type { PluralizationRule } from 'vue-i18n'

const categoryOrder: Intl.LDMLPluralRule[] = ['one', 'few', 'many', 'other']

export function createPluralRule(locale: string): PluralizationRule {
  const rules = new Intl.PluralRules(locale)

  return (choice, choicesLength) => {
    const index = categoryOrder.indexOf(rules.select(choice))
    return Math.min(index, choicesLength - 1)
  }
}
