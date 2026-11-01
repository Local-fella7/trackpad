import { z } from 'zod'

const credential = z.string().trim().min(1).max(120)
export const setupSchema = z.object({ username: credential, displayName: credential, password: z.string().min(6).max(256) })
export const loginSchema = z.object({ username: credential, password: z.string().min(1).max(256) })
export const recoverSchema = z.object({ username: credential, recoveryKey: z.string().min(8).max(64), newPassword: z.string().min(6).max(256) })
