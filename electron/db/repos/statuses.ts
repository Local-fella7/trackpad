import type Database from 'better-sqlite3'

export interface StatusInput { name: string; color: string; isActive: boolean; excludeFromTotals: boolean }
export function listStatuses(db: Database.Database) { return db.prepare('SELECT * FROM statuses ORDER BY sort_order, id').all() }
export function createStatus(db: Database.Database, input: StatusInput) {
  const order = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM statuses').get() as { value: number }).value + 1
  return Number(db.prepare('INSERT INTO statuses (name, color, sort_order, is_active, exclude_from_totals) VALUES (?, ?, ?, ?, ?)').run(input.name, input.color, order, Number(input.isActive), Number(input.excludeFromTotals)).lastInsertRowid)
}
