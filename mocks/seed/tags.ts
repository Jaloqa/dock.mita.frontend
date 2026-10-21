import type { TagRow } from '../db'

export const demoTags = (): TagRow[] =>
  [
    ['tag_anna_abonament', 'abonament'],
    ['tag_anna_praca', 'praca'],
    ['tag_anna_barcelona', 'barcelona'],
    ['tag_anna_remont', 'remont'],
  ].map(([id, name]) => ({ id: id as string, userId: 'usr_anna', name: name as string }))
