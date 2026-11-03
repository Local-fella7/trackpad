import type Database from 'better-sqlite3'

export const reportTypes = ['daily', 'monthly', 'upcoming-events', 'unpaid-invoices', 'delivery-due', 'status-summary', 'client-summary'] as const
export type ReportType = typeof reportTypes[number]
export type ReportParams = { day?: string; month?: string; days?: number }

const records = `SELECT r.*, s.name AS status_name, s.color AS status_color FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL`
const summary = (db: Database.Database, where: string, params: unknown[]) => db.prepare(`SELECT r.currency, COUNT(*) AS records, COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END), 0) AS total_minor FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL ${where} GROUP BY r.currency`).all(...params)

export function getReportData(db: Database.Database, type: ReportType, params: ReportParams = {}) {
  const day = params.day ?? new Date().toISOString().slice(0, 10)
  const month = params.month ?? day.slice(0, 7)
  const days = Math.max(1, Math.min(params.days ?? 7, 365))
  if (type === 'daily') return { type, title: 'Daily business report', period: day, rows: db.prepare(`${records} AND r.record_date = ? ORDER BY r.id`).all(day), summary: summary(db, 'AND r.record_date = ?', [day]) }
  if (type === 'monthly') return { type, title: 'Monthly business report', period: month, rows: db.prepare(`${records} AND r.record_date LIKE ? ORDER BY r.record_date, r.id`).all(`${month}-%`), summary: summary(db, 'AND r.record_date LIKE ?', [`${month}-%`]) }
  if (type === 'upcoming-events') return { type, title: 'Upcoming events', period: `Next ${days} days`, rows: db.prepare(`${records} AND r.event_date BETWEEN date('now') AND date('now', '+' || ? || ' days') ORDER BY r.event_date, r.client_name`).all(days), summary: [] }
  if (type === 'unpaid-invoices') return { type, title: 'Unpaid invoices', period: 'Current', rows: db.prepare(`${records} AND r.invoice_no IS NOT NULL AND r.invoice_no <> '' AND r.paid_at IS NULL ORDER BY r.record_date, r.client_name`).all(), summary: summary(db, "AND r.invoice_no IS NOT NULL AND r.invoice_no <> '' AND r.paid_at IS NULL", []) }
  if (type === 'delivery-due') return { type, title: 'Delivery due', period: 'Due in the next 3 days', rows: db.prepare(`${records} AND r.confirmed_at IS NOT NULL AND r.paid_at IS NOT NULL AND r.delivered_at IS NULL AND r.event_date <= date('now', '+3 days') ORDER BY r.event_date, r.client_name`).all(), summary: [] }
  if (type === 'status-summary') {
    const rows = db.prepare(`SELECT s.name AS status_name, s.color AS status_color, COUNT(r.id) AS records, COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END), 0) AS grand_total_minor, 'TZS' AS currency FROM statuses s LEFT JOIN records r ON r.status_id=s.id AND r.deleted_at IS NULL GROUP BY s.id ORDER BY s.sort_order`).all()
    return { type, title: 'Status summary', period: 'Current', rows, summary: rows }
  }
  const rows = db.prepare(`SELECT r.client_name, COUNT(*) AS records, COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END), 0) AS grand_total_minor, 'TZS' AS currency FROM records r JOIN statuses s ON s.id=r.status_id WHERE r.deleted_at IS NULL GROUP BY r.client_name ORDER BY grand_total_minor DESC, r.client_name`).all()
  return { type, title: 'Client summary', period: 'All records', rows, summary: rows }
}
