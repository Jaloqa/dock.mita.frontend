import { describe, expect, it } from 'bun:test'
import { MONTH_START_DAYS, monthStartOptions } from '../../../../app/features/settings/utils/options'

describe('settings options', () => {
  it('offers days 1 to 28 and the last working day', () => {
    const options = monthStartOptions((day) => `Day ${day}`, 'Last working day')
    expect(options).toHaveLength(MONTH_START_DAYS + 1)
    expect(options[0]).toEqual({ value: 1, label: 'Day 1' })
    expect(options[27]).toEqual({ value: 28, label: 'Day 28' })
    expect(options.at(-1)).toEqual({ value: 'lastWorkingDay', label: 'Last working day' })
  })
})
