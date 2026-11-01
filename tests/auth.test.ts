import { describe, expect, it } from 'vitest'
import { createRecoveryKey, hashSecret, verifySecret } from '../electron/auth'

describe('authentication helpers', () => {
  it('verifies only the secret that created a hash', () => {
    const hash = hashSecret('correct-password')
    expect(verifySecret('correct-password', hash)).toBe(true)
    expect(verifySecret('wrong-password', hash)).toBe(false)
  })
  it('creates a grouped recovery key', () => {
    expect(createRecoveryKey()).toMatch(/^[A-Z0-9_-]{4}(-[A-Z0-9_-]{4}){3}$/)
  })
})
