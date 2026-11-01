import { describe, expect, it } from 'vitest'
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from '../electron/login-attempts'

describe('login throttling', () => {
  it('locks after five failures and clears after reset', () => {
    const username = 'test-user'
    clearLoginFailures(username)
    for (let index = 0; index < 5; index += 1) recordLoginFailure(username)
    expect(() => assertLoginAllowed(username)).toThrow('LOGIN_THROTTLED')
    clearLoginFailures(username)
    expect(() => assertLoginAllowed(username)).not.toThrow()
  })
})
