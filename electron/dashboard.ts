import type Database from 'better-sqlite3'

export function getDashboardData(db: Database.Database, today: string, activityDays = 30) {
  const month = `${today.slice(0, 7)}-%`
  const previousMonth = `${today.slice(0, 7)}-01`
  const recordsToday = (db.prepare('SELECT COUNT(*) AS count FROM records WHERE deleted_at IS NULL AND record_date = ?').get(today) as { count: number }).count
  const activeRecords = (db.prepare('SELECT COUNT(*) AS count FROM records WHERE deleted_at IS NULL').get() as { count: number }).count
  const monthSummary = db.prepare(`SELECT currency, COUNT(*) AS count, COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END), 0) AS total
    FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL AND r.record_date LIKE ? GROUP BY currency`).all(month)
  const previousMonthTotal = (db.prepare(`SELECT COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END),0) AS total FROM records r JOIN statuses s ON s.id=r.status_id WHERE r.deleted_at IS NULL AND r.record_date >= date(?, '-1 month') AND r.record_date < ?`).get(previousMonth, previousMonth) as {total:number}).total
  const byStatus = db.prepare(`SELECT s.name, s.color, COUNT(r.id) AS count FROM statuses s LEFT JOIN records r ON r.status_id = s.id AND r.deleted_at IS NULL GROUP BY s.id ORDER BY s.sort_order`).all()
  const upcomingEvents = db.prepare(`SELECT r.id, r.event_date, r.client_name, r.location, r.contacts, r.grand_total_minor, r.currency, s.name AS status_name FROM records r JOIN statuses s ON s.id=r.status_id WHERE r.deleted_at IS NULL AND r.event_date BETWEEN ? AND date(?, '+30 days') ORDER BY r.event_date`).all(today, today)
  const unpaidCount = (db.prepare("SELECT COUNT(*) AS count FROM records WHERE deleted_at IS NULL AND invoice_no IS NOT NULL AND invoice_no <> '' AND paid_at IS NULL").get() as {count:number}).count
  const deliveryCount = (db.prepare("SELECT COUNT(*) AS count FROM records WHERE deleted_at IS NULL AND confirmed_at IS NOT NULL AND delivered_at IS NULL AND (delivery_form_no IS NULL OR delivery_form_no = '') AND event_date <= date(?, '+3 days')").get(today) as {count:number}).count
  const range = Math.max(7, Math.min(activityDays, 90))
  const eventActivity = db.prepare("SELECT event_date, COALESCE(SUM(grand_total_minor),0) AS total FROM records WHERE deleted_at IS NULL AND confirmed_at IS NOT NULL AND paid_at IS NOT NULL AND event_date BETWEEN date(?, '-' || ? || ' days') AND ? GROUP BY event_date ORDER BY event_date").all(today, range - 1, today)
  const last30Days = db.prepare(`SELECT record_date, COUNT(*) AS count FROM records WHERE deleted_at IS NULL AND record_date BETWEEN date(?, '-29 days') AND ? GROUP BY record_date ORDER BY record_date`).all(today, today)
  const calendar = db.prepare(`SELECT event_date, COUNT(*) AS count, COALESCE(SUM(grand_total_minor),0) AS total FROM records WHERE deleted_at IS NULL AND event_date BETWEEN ? AND date(?, '+6 days') GROUP BY event_date`).all(today, today)
  const revenueByStatus = db.prepare(`SELECT s.name, s.color, COALESCE(SUM(r.grand_total_minor),0) AS total FROM statuses s LEFT JOIN records r ON r.status_id=s.id AND r.deleted_at IS NULL GROUP BY s.id ORDER BY total DESC`).all()
  const topClients = db.prepare(`SELECT client_name, COALESCE(SUM(grand_total_minor),0) AS total FROM records WHERE deleted_at IS NULL GROUP BY client_name ORDER BY total DESC LIMIT 5`).all()
  const recentActivity = db.prepare(`SELECT a.at,a.action,r.client_name,r.record_number FROM audit_log a LEFT JOIN records r ON r.id=a.entity_id WHERE a.entity='record' ORDER BY a.id DESC LIMIT 6`).all()
  const outstandingClients = db.prepare(`SELECT r.client_name, COUNT(*) AS orders, SUM(r.grand_total_minor-COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.record_id=r.id),0)) AS balance_minor FROM records r WHERE r.deleted_at IS NULL GROUP BY r.client_name HAVING balance_minor>0 ORDER BY balance_minor DESC LIMIT 8`).all()
  const currentTotal = Number((monthSummary[0] as {total?:number}|undefined)?.total ?? 0)
  return { recordsToday, activeRecords, monthSummary, previousMonthTotal, valueTrend: previousMonthTotal ? Math.round((currentTotal - previousMonthTotal) / previousMonthTotal * 100) : null, byStatus, upcomingEvents, calendar, revenueByStatus, topClients, outstandingClients, recentActivity, unpaidCount, deliveryCount, eventActivity, activityDays: range, last30Days, generatedAt: new Date().toISOString() }
}
