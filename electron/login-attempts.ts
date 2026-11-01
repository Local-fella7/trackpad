const MAX_ATTEMPTS = 5
const LOCK_MS = 30_000
const attempts = new Map<string, { failures: number; lockedUntil: number }>()

export function assertLoginAllowed(username: string) {
  const state = attempts.get(username.toLocaleLowerCase())
  if (state && state.lockedUntil > Date.now()) throw new Error('LOGIN_THROTTLED')
}

export function recordLoginFailure(username: string) {
  const key = username.toLocaleLowerCase()
  const previous = attempts.get(key) ?? { failures: 0, lockedUntil: 0 }
  const failures = previous.failures + 1
  attempts.set(key, { failures: failures >= MAX_ATTEMPTS ? 0 : failures, lockedUntil: failures >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 })
}

export function clearLoginFailures(username: string) { attempts.delete(username.toLocaleLowerCase()) }
