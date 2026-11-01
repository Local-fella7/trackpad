import Database from 'better-sqlite3'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { migrations } from './migrations'

export function openDatabase(userDataDirectory: string): Database.Database {
  const dataDirectory = path.join(userDataDirectory, 'data')
  const databasePath = path.join(dataDirectory, 'records.db')
  mkdirSync(dataDirectory, { recursive: true })
  const db = new Database(databasePath)
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = FULL')
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  if (currentVersion > migrations.length) throw new Error('DB_TOO_NEW')

  for (let index = currentVersion; index < migrations.length; index += 1) {
    if (currentVersion > 0 && existsSync(databasePath)) copyFileSync(databasePath, `${databasePath}.before-migration`)
    db.transaction(() => { db.exec(migrations[index]!); db.pragma(`user_version = ${index + 1}`) })()
  }
  return db
}
