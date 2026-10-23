import { emailRules } from '../../../shared/utils/email'

export type InviteForm = { email: string }

export const inviteRules = (t: (key: string) => string) => ({ email: emailRules(t) })
