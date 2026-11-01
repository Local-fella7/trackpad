export interface SessionUser { id: number; username: string; displayName: string }

let currentUser: SessionUser | null = null
let lastActivityAt = 0

export function login(user: SessionUser) { currentUser = user; lastActivityAt = Date.now() }
export function logout() { currentUser = null; lastActivityAt = 0 }
export function touchSession() { if (currentUser) lastActivityAt = Date.now() }
export function lockIfIdle(minutes: number) { if (currentUser && minutes > 0 && Date.now() - lastActivityAt >= minutes * 60_000) logout(); return currentUser }
export function getSessionUser() { return currentUser }
export function requireSessionUser(): SessionUser {
  if (!currentUser) throw new Error('NOT_LOGGED_IN')
  return currentUser
}
