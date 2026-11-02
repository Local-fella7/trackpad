import { describe, expect, it } from 'vitest'
import { createRecoveryKey, hashSecret, verifySecret } from '../electron/auth'

describe('authentication helpers', () => {
  it('verifies only the secret that created a hash', async () => {
    const hash = await hashSecret('correct-password')
    await expect(verifySecret('correct-password', hash)).resolves.toBe(true)
    await expect(verifySecret('wrong-password', hash)).resolves.toBe(false)
  })
  it('creates a grouped recovery key', () => {
    expect(createRecoveryKey()).toMatch(/^[A-Z0-9_-]{4}(-[A-Z0-9_-]{4}){3}$/)
  })
})
