export const tagAutoCompletePt = (describedBy?: string) => ({
  inputMultiple: { role: 'list', 'aria-orientation': undefined, 'aria-activedescendant': undefined },
  chipItem: {
    role: 'listitem',
    'aria-label': undefined,
    'aria-selected': undefined,
    'aria-setsize': undefined,
    'aria-posinset': undefined,
  },
  inputChip: { role: 'presentation' },
  input: { 'aria-describedby': describedBy },
})
