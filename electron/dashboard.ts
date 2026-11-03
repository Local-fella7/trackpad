import type Database from 'better-sqlite3'

export function getDashboardData(db: Database.Database, today: string) {
  const month = `${today.slice(0, 7)}-%`
  const recordsToday = (db.prepare('SELECT COUNT(*) AS count FROM records WHERE deleted_at IS NULL AND record_date = ?').get(today) as { count: number }).count
  const activeRecords = (db.prepare('SELECT COUNT(*) AS count FROM records WHERE deleted_at IS NULL').get() as { count: number }).count
  const monthSummary = db.prepare(`SELECT currency, COUNT(*) AS count, COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END), 0) AS total
    FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL AND r.record_date LIKE ? GROUP BY currency`).all(month)
  const byStatus = db.prepare(`SELECT s.name, s.color, COUNT(r.id) AS count FROM statuses s LEFT JOIN records r ON r.status_id = s.id AND r.deleted_at IS NULL GROUP BY s.id ORDER BY s.sort_order`).all()
  const upcomingEvents = db.prepare(`SELECT r.id, r.event_date, r.client_name, r.location, r.contacts, r.grand_total_minor, r.currency, s.name AS status_name
    FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL AND r.event_date BETWEEN ? AND date(?, '+7 days') ORDER BY r.event_date, r.client_name`).all(today, today)
  const last30Days = db.prepare(`SELECT record_date, COUNT(*) AS count FROM records WHERE deleted_at IS NULL AND record_date BETWEEN date(?, '-29 days') AND ? GROUP BY record_date ORDER BY record_date`).all(today, today)
  return { recordsToday, activeRecords, monthSummary, byStatus, upcomingEvents, last30Days }
}
