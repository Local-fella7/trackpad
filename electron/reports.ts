import type Database from 'better-sqlite3'

export const reportTypes = [
  'general',
  'daily',
  'monthly',
  'upcoming-events',
  'unpaid-invoices',
  'delivery-due',
  'status-summary',
  'client-summary',
] as const

export type ReportType = (typeof reportTypes)[number]
export type ReportParams = { day?: string; month?: string; days?: number }

export interface ReportColumn {
  key: string
  label: string
  kind?: 'text' | 'date' | 'money' | 'number'
  total?: boolean
}

const paidSubquery = `COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.record_id = r.id), 0)`
const itemsSubquery = `COALESCE((SELECT GROUP_CONCAT(ri.description || ' x' || CAST(ri.quantity_x100 / 100 AS INTEGER), ', ') FROM record_items ri WHERE ri.record_id = r.id), '-')`

const baseSelect = `SELECT
  r.*,
  s.name AS status_name,
  s.color AS status_color,
  ${paidSubquery} AS paid_minor,
  MAX(0, r.grand_total_minor - ${paidSubquery}) AS balance_minor,
  ${itemsSubquery} AS items_summary,
  CAST(MAX(0, julianday('now') - julianday(r.record_date)) AS INTEGER) AS age_days,
  CASE
    WHEN r.event_date IS NULL OR r.event_date = '' THEN '-'
    WHEN r.event_date = date('now') THEN 'Today'
    ELSE CAST(julianday(r.event_date) - julianday(date('now')) AS INTEGER) || ' days'
  END AS days_until,
  CASE
    WHEN ${paidSubquery} <= 0 THEN 'Pending'
    WHEN ${paidSubquery} < r.grand_total_minor THEN 'Partially Paid'
    ELSE 'Fully Paid'
  END AS payment_status
  FROM records r
  JOIN statuses s ON s.id = r.status_id
  WHERE r.deleted_at IS NULL`

const summary = (db: Database.Database, where: string, params: unknown[]) =>
  db
    .prepare(
      `SELECT r.currency, COUNT(*) AS records, COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END), 0) AS total_minor FROM records r JOIN statuses s ON s.id = r.status_id WHERE r.deleted_at IS NULL ${where} GROUP BY r.currency`,
    )
    .all(...params)

export function getReportData(db: Database.Database, type: ReportType, params: ReportParams = {}) {
  const day = params.day ?? new Date().toISOString().slice(0, 10)
  const month = params.month ?? day.slice(0, 7)
  const days = Math.max(1, Math.min(params.days ?? 7, 365))

  if (type === 'general') {
    const columns: ReportColumn[] = [
      { key: 'record_number', label: 'Order No', kind: 'text' },
      { key: 'client_name', label: 'Client Name', kind: 'text' },
      { key: 'record_date', label: 'Order Date', kind: 'date' },
      { key: 'event_date', label: 'Event Date', kind: 'date' },
      { key: 'status_name', label: 'Status', kind: 'text' },
      { key: 'invoice_no', label: 'Invoice No', kind: 'text' },
      { key: 'location', label: 'Location', kind: 'text' },
      { key: 'payment_status', label: 'Payment Status', kind: 'text' },
      { key: 'grand_total_minor', label: 'Total Amount', kind: 'money', total: true },
      { key: 'paid_minor', label: 'Amount Paid', kind: 'money', total: true },
      { key: 'balance_minor', label: 'Balance Due', kind: 'money', total: true },
    ]
    return {
      type,
      title: 'General Orders Master Report',
      period: 'All Records',
      columns,
      rows: db.prepare(`${baseSelect} ORDER BY r.record_date DESC, r.id DESC`).all(),
      summary: summary(db, '', []),
    }
  }

  if (type === 'daily') {
    const columns: ReportColumn[] = [
      { key: 'record_number', label: 'Order No', kind: 'text' },
      { key: 'client_name', label: 'Client Name', kind: 'text' },
      { key: 'contacts', label: 'Contacts', kind: 'text' },
      { key: 'items_summary', label: 'Items / Services', kind: 'text' },
      { key: 'status_name', label: 'Status', kind: 'text' },
      { key: 'subtotal_minor', label: 'Subtotal', kind: 'money', total: true },
      { key: 'tax_minor', label: 'Tax', kind: 'money', total: true },
      { key: 'grand_total_minor', label: 'Total Amount', kind: 'money', total: true },
      { key: 'paid_minor', label: 'Amount Paid', kind: 'money', total: true },
      { key: 'balance_minor', label: 'Balance Due', kind: 'money', total: true },
    ]
    return {
      type,
      title: 'Daily Orders Register',
      period: day,
      columns,
      rows: db.prepare(`${baseSelect} AND r.record_date = ? ORDER BY r.id`).all(day),
      summary: summary(db, 'AND r.record_date = ?', [day]),
    }
  }

  if (type === 'monthly') {
    const columns: ReportColumn[] = [
      { key: 'record_date', label: 'Order Date', kind: 'date' },
      { key: 'record_number', label: 'Order No', kind: 'text' },
      { key: 'invoice_no', label: 'Invoice No', kind: 'text' },
      { key: 'client_name', label: 'Client Name', kind: 'text' },
      { key: 'status_name', label: 'Status', kind: 'text' },
      { key: 'payment_status', label: 'Payment Status', kind: 'text' },
      { key: 'grand_total_minor', label: 'Total Billed', kind: 'money', total: true },
      { key: 'paid_minor', label: 'Amount Paid', kind: 'money', total: true },
      { key: 'balance_minor', label: 'Balance Due', kind: 'money', total: true },
    ]
    return {
      type,
      title: 'Monthly Revenue & Orders Statement',
      period: month,
      columns,
      rows: db.prepare(`${baseSelect} AND r.record_date LIKE ? ORDER BY r.record_date, r.id`).all(`${month}-%`),
      summary: summary(db, 'AND r.record_date LIKE ?', [`${month}-%`]),
    }
  }

  if (type === 'upcoming-events') {
    const columns: ReportColumn[] = [
      { key: 'event_date', label: 'Event Date', kind: 'date' },
      { key: 'days_until', label: 'Schedule', kind: 'text' },
      { key: 'record_number', label: 'Order No', kind: 'text' },
      { key: 'client_name', label: 'Client Name', kind: 'text' },
      { key: 'contacts', label: 'Contacts', kind: 'text' },
      { key: 'location', label: 'Event Location', kind: 'text' },
      { key: 'items_summary', label: 'Items / Services', kind: 'text' },
      { key: 'status_name', label: 'Status', kind: 'text' },
      { key: 'payment_status', label: 'Billing', kind: 'text' },
      { key: 'grand_total_minor', label: 'Order Value', kind: 'money', total: true },
    ]
    return {
      type,
      title: 'Upcoming Events Operational Schedule',
      period: `Next ${days} days`,
      columns,
      rows: db
        .prepare(
          `${baseSelect} AND r.event_date BETWEEN date('now') AND date('now', '+' || ? || ' days') ORDER BY r.event_date, r.client_name`,
        )
        .all(days),
      summary: [],
    }
  }

  if (type === 'unpaid-invoices') {
    const balanceWhere = `AND LOWER(s.name) <> 'cancelled' AND r.grand_total_minor > ${paidSubquery}`
    const columns: ReportColumn[] = [
      { key: 'record_date', label: 'Order Date', kind: 'date' },
      { key: 'record_number', label: 'Order No', kind: 'text' },
      { key: 'invoice_no', label: 'Invoice No', kind: 'text' },
      { key: 'client_name', label: 'Client Name', kind: 'text' },
      { key: 'contacts', label: 'Contacts', kind: 'text' },
      { key: 'age_days', label: 'Age (Days)', kind: 'number' },
      { key: 'grand_total_minor', label: 'Invoiced Amount', kind: 'money', total: true },
      { key: 'paid_minor', label: 'Amount Paid', kind: 'money', total: true },
      { key: 'balance_minor', label: 'Balance Due', kind: 'money', total: true },
    ]
    return {
      type,
      title: 'Outstanding Invoices & Receivables Report',
      period: 'Current',
      columns,
      rows: db.prepare(`${baseSelect} ${balanceWhere} ORDER BY balance_minor DESC, r.record_date`).all(),
      summary: summary(db, balanceWhere, []),
    }
  }

  if (type === 'delivery-due') {
    const columns: ReportColumn[] = [
      { key: 'event_date', label: 'Event Date', kind: 'date' },
      { key: 'record_number', label: 'Order No', kind: 'text' },
      { key: 'order_form_no', label: 'Order Form No', kind: 'text' },
      { key: 'delivery_form_no', label: 'Delivery Form No', kind: 'text' },
      { key: 'client_name', label: 'Client Name', kind: 'text' },
      { key: 'contacts', label: 'Contacts', kind: 'text' },
      { key: 'location', label: 'Delivery Location', kind: 'text' },
      { key: 'items_summary', label: 'Items to Deliver', kind: 'text' },
      { key: 'grand_total_minor', label: 'Order Value', kind: 'money', total: true },
    ]
    return {
      type,
      title: 'Delivery Due Dispatch Sheet',
      period: 'Due in the next 3 days',
      columns,
      rows: db
        .prepare(
          `${baseSelect} AND LOWER(s.name) <> 'cancelled' AND r.confirmed_at IS NOT NULL AND ${paidSubquery} >= r.grand_total_minor AND r.delivered_at IS NULL AND r.event_date <= date('now', '+3 days') ORDER BY r.event_date, r.client_name`,
        )
        .all(),
      summary: [],
    }
  }

  if (type === 'status-summary') {
    const normalizedStatus =
      "CASE WHEN LOWER(s.name)='cancelled' THEN 'Cancelled' WHEN LOWER(s.name) IN ('confirmed','paid','delivered','proforma sent','invoiced') OR r.confirmed_at IS NOT NULL THEN 'Confirmed' ELSE 'Pending' END"
    const rows = db
      .prepare(
        `SELECT
          ${normalizedStatus} AS status_name,
          COUNT(r.id) AS records,
          COALESCE(SUM(CASE WHEN LOWER(s.name)='cancelled' THEN 0 ELSE r.grand_total_minor END), 0) AS grand_total_minor,
          COALESCE(SUM(CASE WHEN LOWER(s.name)='cancelled' THEN 0 ELSE ${paidSubquery} END), 0) AS paid_minor,
          COALESCE(SUM(CASE WHEN LOWER(s.name)='cancelled' THEN 0 ELSE MAX(0, r.grand_total_minor - ${paidSubquery}) END), 0) AS balance_minor,
          'TZS' AS currency
        FROM statuses s
        LEFT JOIN records r ON r.status_id = s.id AND r.deleted_at IS NULL
        GROUP BY status_name
        ORDER BY CASE status_name WHEN 'Pending' THEN 1 WHEN 'Confirmed' THEN 2 ELSE 3 END`,
      )
      .all()
    const columns: ReportColumn[] = [
      { key: 'status_name', label: 'Workflow Status', kind: 'text' },
      { key: 'records', label: 'Orders Count', kind: 'number', total: true },
      { key: 'grand_total_minor', label: 'Total Billed', kind: 'money', total: true },
      { key: 'paid_minor', label: 'Total Paid', kind: 'money', total: true },
      { key: 'balance_minor', label: 'Outstanding Balance', kind: 'money', total: true },
    ]
    return { type, title: 'Order Status Financial Summary', period: 'Current', columns, rows, summary: rows }
  }

  const rows = db
    .prepare(
      `SELECT
        r.client_name,
        COALESCE(MAX(NULLIF(r.contacts, '')), '-') AS contacts,
        COUNT(*) AS records,
        MAX(r.record_date) AS last_record_date,
        COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN r.grand_total_minor ELSE 0 END), 0) AS grand_total_minor,
        COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN ${paidSubquery} ELSE 0 END), 0) AS paid_minor,
        COALESCE(SUM(CASE WHEN s.exclude_from_totals = 0 THEN MAX(0, r.grand_total_minor - ${paidSubquery}) ELSE 0 END), 0) AS balance_minor,
        'TZS' AS currency
      FROM records r
      JOIN statuses s ON s.id = r.status_id
      WHERE r.deleted_at IS NULL
      GROUP BY r.client_name
      ORDER BY grand_total_minor DESC, r.client_name`,
    )
    .all()
  const columns: ReportColumn[] = [
    { key: 'client_name', label: 'Client Name', kind: 'text' },
    { key: 'contacts', label: 'Contacts', kind: 'text' },
    { key: 'records', label: 'Orders Count', kind: 'number', total: true },
    { key: 'last_record_date', label: 'Last Order Date', kind: 'date' },
    { key: 'grand_total_minor', label: 'Total Billed', kind: 'money', total: true },
    { key: 'paid_minor', label: 'Total Paid', kind: 'money', total: true },
    { key: 'balance_minor', label: 'Outstanding Balance', kind: 'money', total: true },
  ]
  return { type, title: 'Client Account & Revenue Summary', period: 'All Records', columns, rows, summary: rows }
}
