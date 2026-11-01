import type Database from 'better-sqlite3'

export function getSettings(db: Database.Database): Record<string, string> {
  return Object.fromEntries((db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]).map(({ key, value }) => [key, value]))
}

export function setSetting(db: Database.Database, key: string, value: string) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}
