import type Database from 'better-sqlite3'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'

export async function createBackup(db: Database.Database, directory: string, reason = 'manual') {
  mkdirSync(directory, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
  const file = path.join(directory, `records_${stamp}_${reason}.db`)
  await db.backup(file)
  const check = new Database(file, { readonly: true }).pragma('integrity_check', { simple: true }) as string
  if (check !== 'ok') { rmSync(file, { force: true }); throw new Error('BACKUP_INTEGRITY_FAILED') }
  return file
}

export function listBackups(directory: string) {
  if (!existsSync(directory)) return []
  return readdirSync(directory).filter(file => file.endsWith('.db')).sort().reverse()
}

export function backupHealth(directory: string) {
  const newest = listBackups(directory)[0]
  if (!newest) return { ok: false, message: 'No backup found.' }
  const ageHours = (Date.now() - statSync(path.join(directory, newest)).mtimeMs) / 3_600_000
  return { ok: Number.isFinite(ageHours) && ageHours < 48, newest, message: 'Backup found.' }
}

export function applyRetention(directory: string, keep = 100) {
  const old = listBackups(directory).slice(keep)
  old.forEach(file => rmSync(path.join(directory, file), { force: true }))
  return old.length
}

export function validateBackup(file: string) {
  const db = new Database(file, { readonly: true })
  try { return db.pragma('integrity_check', { simple: true }) === 'ok' && Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'records'").get()) } finally { db.close() }
}

export function copyBackupToDirectory(file: string, directory: string) {
  mkdirSync(directory, { recursive: true })
  const target = path.join(directory, path.basename(file))
  copyFileSync(file, target)
  return target
}
