import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hashSecret(secret: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(secret.normalize('NFKC'), salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifySecret(secret: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(secret.normalize('NFKC'), Buffer.from(saltHex, 'hex'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function createRecoveryKey(): string {
  return randomBytes(12).toString('base64url').toUpperCase().match(/.{1,4}/g)?.join('-') ?? ''
}
