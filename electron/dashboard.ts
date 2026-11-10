import type Database from 'better-sqlite3'

export function getDashboardData(db: Database.Database, today: string, activityDays = 30) {
  const month = `${today.slice(0, 7)}-%`
  const previousMonth = `${today.slice(0, 7)}-01`
  const recordsToday = (db.prepare('SELECT COUNT(*) AS count FROM records WHERE deleted_at IS NULL AND record_date = ?').get(today) as { count: number }).count
  const activeRecords = (db.prepare('SELECT COUNT(*) AS count FROM records WHERE deleted_at IS NULL').get() as { count: number }).count
  const monthSummary = db.prepare(`SELECT currency, COUNT(*) AS count, COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END), 0) AS total
    FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL AND r.record_date LIKE ? GROUP BY currency`).all(month)
  const previousMonthTotal = (db.prepare(`SELECT COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END),0) AS total FROM records r JOIN statuses s ON s.id=r.status_id WHERE r.deleted_at IS NULL AND r.record_date >= date(?, '-1 month') AND r.record_date < ?`).get(previousMonth, previousMonth) as {total:number}).total
  const confirmedExpr = "(LOWER(s.name) IN ('confirmed','paid','delivered','proforma sent','invoiced') OR r.confirmed_at IS NOT NULL)"
  const normalizedStatus = `CASE WHEN LOWER(s.name)='cancelled' THEN 'Cancelled' WHEN ${confirmedExpr} THEN 'Confirmed' ELSE 'Pending' END`
  const byStatus = db.prepare(`SELECT ${normalizedStatus} AS name, CASE WHEN LOWER(s.name)='cancelled' THEN '#76453B' WHEN ${confirmedExpr} THEN '#43766C' ELSE '#B19470' END AS color, COUNT(r.id) AS count FROM statuses s LEFT JOIN records r ON r.status_id = s.id AND r.deleted_at IS NULL GROUP BY name ORDER BY CASE name WHEN 'Pending' THEN 1 WHEN 'Confirmed' THEN 2 ELSE 3 END`).all()
  const paidTotal = Number((db.prepare(`SELECT COALESCE(SUM(p.amount_minor),0) AS total FROM payments p JOIN records r ON r.id=p.record_id WHERE r.deleted_at IS NULL`).get() as {total:number}).total)
  const outstandingTotal = Number((db.prepare(`SELECT COALESCE(SUM(r.grand_total_minor-COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.record_id=r.id),0)),0) AS total FROM records r JOIN statuses s ON s.id=r.status_id WHERE r.deleted_at IS NULL AND LOWER(s.name)<> 'cancelled' AND r.grand_total_minor>COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.record_id=r.id),0)`).get() as {total:number}).total)
  const upcomingEvents = db.prepare(`SELECT r.id, r.event_date, r.client_name, r.location, r.contacts, r.grand_total_minor, r.currency, s.name AS status_name, CASE WHEN ${confirmedExpr} THEN 1 ELSE 0 END AS is_confirmed FROM records r JOIN statuses s ON s.id=r.status_id WHERE r.deleted_at IS NULL AND LOWER(s.name) <> 'cancelled' AND r.event_date BETWEEN ? AND date(?, '+30 days') ORDER BY r.event_date`).all(today, today)
  const unpaidCount = (db.prepare(`SELECT COUNT(*) AS count FROM records r JOIN statuses s ON s.id=r.status_id WHERE r.deleted_at IS NULL AND LOWER(s.name)<> 'cancelled' AND r.grand_total_minor>COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.record_id=r.id),0)`).get() as {count:number}).count
  const deliveryCount = (db.prepare("SELECT COUNT(*) AS count FROM records WHERE deleted_at IS NULL AND confirmed_at IS NOT NULL AND delivered_at IS NULL AND (delivery_form_no IS NULL OR delivery_form_no = '') AND event_date <= date(?, '+3 days')").get(today) as {count:number}).count
  const range = Math.max(7, Math.min(activityDays, 90))
  const eventActivity = db.prepare("SELECT event_date, COALESCE(SUM(grand_total_minor),0) AS total FROM records WHERE deleted_at IS NULL AND confirmed_at IS NOT NULL AND paid_at IS NOT NULL AND event_date BETWEEN date(?, '-' || ? || ' days') AND ? GROUP BY event_date ORDER BY event_date").all(today, range - 1, today)
  const last30Days = db.prepare(`SELECT record_date, COUNT(*) AS count FROM records WHERE deleted_at IS NULL AND record_date BETWEEN date(?, '-29 days') AND ? GROUP BY record_date ORDER BY record_date`).all(today, today)
  const calendar = db.prepare(`SELECT r.event_date, COUNT(*) AS count,
    SUM(CASE WHEN ${confirmedExpr} THEN 1 ELSE 0 END) AS confirmed_count,
    SUM(CASE WHEN NOT ${confirmedExpr} THEN 1 ELSE 0 END) AS pending_count,
    COALESCE(SUM(r.grand_total_minor), 0) AS total
    FROM records r JOIN statuses s ON s.id = r.status_id
    WHERE r.deleted_at IS NULL AND r.event_date IS NOT NULL AND r.event_date <> '' AND LOWER(s.name) <> 'cancelled'
    GROUP BY r.event_date`).all()
  const revenueByStatus = db.prepare(`SELECT s.name, s.color, COALESCE(SUM(r.grand_total_minor),0) AS total FROM statuses s LEFT JOIN records r ON r.status_id=s.id AND r.deleted_at IS NULL GROUP BY s.id ORDER BY total DESC`).all()
  const topClients = db.prepare(`SELECT client_name, COALESCE(SUM(grand_total_minor),0) AS total FROM records WHERE deleted_at IS NULL GROUP BY client_name ORDER BY total DESC LIMIT 5`).all()
  const outstandingClients = db.prepare(`SELECT r.client_name, COUNT(*) AS orders, SUM(r.grand_total_minor-COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.record_id=r.id),0)) AS balance_minor FROM records r JOIN statuses s ON s.id=r.status_id WHERE r.deleted_at IS NULL AND LOWER(s.name)<> 'cancelled' GROUP BY r.client_name HAVING balance_minor>0 ORDER BY balance_minor DESC LIMIT 8`).all()
  const currentTotal = Number((monthSummary[0] as {total?:number}|undefined)?.total ?? 0)
  return { recordsToday, activeRecords, monthSummary, previousMonthTotal, paidTotal, outstandingTotal, valueTrend: previousMonthTotal ? Math.round((currentTotal - previousMonthTotal) / previousMonthTotal * 100) : null, byStatus, upcomingEvents, calendar, revenueByStatus, topClients, outstandingClients, unpaidCount, deliveryCount, eventActivity, activityDays: range, last30Days, generatedAt: new Date().toISOString() }
}
