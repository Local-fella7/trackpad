import type Database from 'better-sqlite3'

export type ReportType = 'daily' | 'monthly' | 'upcoming-events'

export function getReportData(db: Database.Database, type: ReportType, params: { day?: string; month?: string; days?: number }) {
  if (type === 'daily') {
    const day = params.day ?? new Date().toISOString().slice(0, 10)
    const rows = db.prepare(`SELECT r.*, s.name AS status_name, s.color AS status_color FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL AND r.record_date = ? ORDER BY r.id`).all(day)
    const summary = db.prepare(`SELECT r.currency, COUNT(*) AS records, COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END), 0) AS total_minor FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL AND r.record_date = ? GROUP BY r.currency`).all(day)
    return { type, period: day, rows, summary }
  }
  if (type === 'upcoming-events') {
    const days = Math.max(1, Math.min(params.days ?? 7, 365))
    const rows = db.prepare(`SELECT r.*, s.name AS status_name FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL AND r.event_date BETWEEN date('now') AND date('now', '+' || ? || ' days') ORDER BY r.event_date, r.client_name`).all(days)
    return { type, period: `${days} days`, rows, summary: [] }
  }
  const month = params.month ?? new Date().toISOString().slice(0, 7)
  const rows = db.prepare(`SELECT r.*, s.name AS status_name FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL AND r.record_date LIKE ? ORDER BY r.record_date, r.id`).all(`${month}-%`)
  const summary = db.prepare(`SELECT r.record_date, r.currency, COUNT(*) AS records, COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END), 0) AS total_minor FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL AND r.record_date LIKE ? GROUP BY r.record_date, r.currency ORDER BY r.record_date`).all(`${month}-%`)
  return { type, period: month, rows, summary }
}
