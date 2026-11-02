import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(secret.normalize('NFKC'), salt, 64) as Buffer
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(secret.normalize('NFKC'), Buffer.from(saltHex, 'hex'), expected.length) as Buffer
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function createRecoveryKey(): string {
  return randomBytes(12).toString('base64url').toUpperCase().match(/.{1,4}/g)?.join('-') ?? ''
}
