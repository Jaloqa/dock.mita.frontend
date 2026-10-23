import { describe, expect, it } from 'bun:test'
import { addGroupTag, groupTagOptions, usedGroupTags } from '../../../../app/features/groups/utils/groupTags'

const ten = Array.from({ length: 10 }, (_, index) => `tag ${index + 1}`)

describe('group tags', () => {
  it('adds a trimmed tag once, ignoring case', () => {
    expect(addGroupTag([], '  beach ')).toEqual(['beach'])
    expect(addGroupTag(['Beach'], 'BEACH')).toEqual(['Beach'])
    expect(addGroupTag(['Beach'], '   ')).toEqual(['Beach'])
    expect(addGroupTag(['Beach'], 'food')).toEqual(['Beach', 'food'])
  })

  it('adds an eleventh tag so that the form can report too many', () => {
    expect(addGroupTag(ten.slice(0, 9), 'tenth')).toHaveLength(10)
    expect(addGroupTag(ten, 'eleventh')).toEqual([...ten, 'eleventh'])
  })

  it('lists the tags used in the group once, in their first spelling', () => {
    expect(
      usedGroupTags([{ tags: ['Dinner', 'beach'] }, { tags: [] }, { tags: ['dinner', 'Ferry'] }, { tags: ['BEACH'] }]),
    ).toEqual(['Dinner', 'beach', 'Ferry'])
  })

  it('offers the typed tag first and then the matching used tags that are not chosen', () => {
    expect(groupTagOptions('be', ['beach', 'beer', 'dinner'], ['beer'])).toEqual([
      { name: 'be', create: true },
      { name: 'beach', create: false },
    ])
  })

  it('offers a used tag in its spelling instead of the typed one', () => {
    expect(groupTagOptions('BEACH', ['beach', 'beach bar'], [])).toEqual([
      { name: 'beach', create: false },
      { name: 'beach bar', create: false },
    ])
  })

  it('offers nothing for blank text or a chosen tag', () => {
    expect(groupTagOptions('  ', ['beach'], [])).toEqual([])
    expect(groupTagOptions('beach', ['beach'], ['Beach'])).toEqual([])
  })

  it('still offers tags when ten are chosen', () => {
    expect(groupTagOptions('beach', ['beach'], ten)).toEqual([{ name: 'beach', create: false }])
  })

  it('offers at most ten options', () => {
    const used = Array.from({ length: 20 }, (_, index) => `tag ${index + 1}`)
    expect(groupTagOptions('tag', used, [])).toHaveLength(10)
  })
})
