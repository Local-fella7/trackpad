import type Database from 'better-sqlite3'

export interface StatusInput { name: string; color: string; isActive: boolean; excludeFromTotals: boolean }
export function listStatuses(db: Database.Database) { return db.prepare('SELECT * FROM statuses WHERE is_active = 1 ORDER BY sort_order, id').all() }
export function createStatus(db: Database.Database, input: StatusInput) {
  const order = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM statuses').get() as { value: number }).value + 1
  return Number(db.prepare('INSERT INTO statuses (name, color, sort_order, is_active, exclude_from_totals) VALUES (?, ?, ?, ?, ?)').run(input.name, input.color, order, Number(input.isActive), Number(input.excludeFromTotals)).lastInsertRowid)
}

export function updateStatus(db: Database.Database, id: number, input: StatusInput) {
  return db.prepare('UPDATE statuses SET name = ?, color = ?, is_active = ?, exclude_from_totals = ? WHERE id = ?').run(input.name, input.color, Number(input.isActive), Number(input.excludeFromTotals), id).changes
}

export function setDefaultStatus(db: Database.Database, id: number) {
  return db.transaction(() => { db.prepare('UPDATE statuses SET is_default = 0').run(); return db.prepare('UPDATE statuses SET is_default = 1 WHERE id = ?').run(id).changes })()
}

export function reorderStatuses(db: Database.Database, ids: number[]) {
  const statement = db.prepare('UPDATE statuses SET sort_order = ? WHERE id = ?')
  return db.transaction(() => ids.forEach((id, index) => statement.run(index + 1, id)))()
}

export function removeStatus(db: Database.Database, id: number) {
  const usage = (db.prepare('SELECT COUNT(*) AS count FROM records WHERE status_id = ?').get(id) as { count: number }).count
  if (usage) throw new Error('STATUS_IN_USE')
  return db.prepare('DELETE FROM statuses WHERE id = ?').run(id).changes
}
