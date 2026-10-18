export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous'

export const useSessionStatus = () => useState<SessionStatus>('session-status', () => 'unknown')
