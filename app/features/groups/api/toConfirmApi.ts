import type { ApiClient } from '~/shared/api/client'
import type { Page, ToConfirmInput, ToConfirmItemDto, ToConfirmKind, ToConfirmRejectInput } from '~/shared/api/contract'

export const TO_CONFIRM_PAGE_SIZE = 100

const itemPath = (kind: ToConfirmKind, entryId: string) =>
  `/v1/to-confirm/${kind === 'expense' ? 'expenses' : 'repayments'}/${encodeURIComponent(entryId)}`

export const toConfirmApi = (api: ApiClient) => ({
  list: (page: number) => api.get<Page<ToConfirmItemDto>>('/v1/to-confirm', { page, pageSize: TO_CONFIRM_PAGE_SIZE }),
  count: async () => (await api.get<Page<ToConfirmItemDto>>('/v1/to-confirm', { pageSize: 1 })).total,
  confirm: (kind: ToConfirmKind, entryId: string, body: ToConfirmInput) =>
    api.post(`${itemPath(kind, entryId)}/confirm`, body),
  reject: (kind: ToConfirmKind, entryId: string, version: string) =>
    api.post(`${itemPath(kind, entryId)}/reject`, { version } satisfies ToConfirmRejectInput),
})
