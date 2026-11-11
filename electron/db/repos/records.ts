import type Database from 'better-sqlite3'
import { calculateTotals } from '../../../shared/money'
import type { CurrencyCode, ItemInput } from '../../../shared/types'
import { writeAudit } from './audit'

export interface RecordInput {
  recordDate: string
  recordNumber?: string
  clientName: string
  contacts?: string
  location?: string
  sourceOfInfo?: string
  proformaNo?: string
  invoiceNo?: string
  eventDate?: string
  orderFormNo?: string
  deliveryFormNo?: string
  statusId: number
  currency: CurrencyCode
  discountMinor?: number
  taxRateBasisPoints?: number
  notes?: string
}

const nullable = (value?: string) => value?.trim() || null

/**
 * Automatically transition orders to 'Completed' when:
 * 1) The order is Confirmed (or has confirmed_at set),
 * 2) It is Fully Paid (total payments >= grand_total_minor and grand_total_minor > 0), and
 * 3) Its event_date (or record_date if no event_date) is in the past (< date('now')).
 */
export function syncCompletedOrders(db: Database.Database) {
  const completedStatus = db
    .prepare("SELECT id FROM statuses WHERE LOWER(name) = 'completed' AND is_active = 1 LIMIT 1")
    .get() as { id: number } | undefined
  if (!completedStatus) return 0

  const result = db
    .prepare(
      `UPDATE records
       SET status_id = ?,
           delivered_at = COALESCE(delivered_at, datetime('now')),
           updated_at = datetime('now')
       WHERE deleted_at IS NULL
         AND status_id <> ?
         AND status_id IN (SELECT id FROM statuses WHERE LOWER(name) = 'confirmed')
         AND grand_total_minor > 0
         AND COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.record_id = records.id), 0) >= grand_total_minor
         AND COALESCE(NULLIF(event_date, ''), record_date) < date('now')`,
    )
    .run(completedStatus.id, completedStatus.id)

  return result.changes
}

export function saveRecord(
  db: Database.Database,
  id: number | null,
  input: RecordInput,
  items: readonly ItemInput[],
  userId: number | null,
) {
  return db.transaction(() => {
    const discountMinor = Math.max(0, Math.round(Number(input.discountMinor ?? 0) || 0))
    const totals = calculateTotals(items, discountMinor)
    if (
      !input.clientName.trim() ||
      !input.recordDate ||
      !items.length ||
      items.some(item => !item.description.trim() || item.quantity <= 0 || item.unitPrice < 0)
    )
      throw new Error('INVALID_RECORD')

    const existing =
      id === null
        ? undefined
        : (db.prepare('SELECT * FROM records WHERE id = ? AND deleted_at IS NULL').get(id) as
            | Record<string, unknown>
            | undefined)
    if (id !== null && !existing) throw new Error('INVALID_INPUT')

    const statusRow = db.prepare('SELECT name FROM statuses WHERE id = ?').get(input.statusId) as
      | { name: string }
      | undefined
    const isConfirmedStatus = ['confirmed', 'completed'].includes(String(statusRow?.name || '').toLowerCase())

    const values = [
      input.recordDate,
      nullable(input.recordNumber),
      input.clientName.trim(),
      nullable(input.contacts),
      nullable(input.location),
      nullable(input.sourceOfInfo),
      nullable(input.proformaNo),
      nullable(input.invoiceNo),
      nullable(input.eventDate),
      nullable(input.orderFormNo),
      nullable(input.deliveryFormNo),
      input.statusId,
      input.currency,
      0,
      totals.subtotal,
      totals.discount,
      0,
      totals.grandTotal,
      nullable(input.notes),
    ]

    const recordId =
      id === null
        ? Number(
            db
              .prepare(
                'INSERT INTO records (record_date, record_number, client_name, contacts, location, source_of_info, proforma_no, invoice_no, event_date, order_form_no, delivery_form_no, status_id, currency, tax_rate_bp, subtotal_minor, discount_minor, tax_minor, grand_total_minor, notes, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .run(...values, isConfirmedStatus ? new Date().toISOString() : null).lastInsertRowid,
          )
        : (db
            .prepare(
              "UPDATE records SET record_date=?, record_number=?, client_name=?, contacts=?, location=?, source_of_info=?, proforma_no=?, invoice_no=?, event_date=?, order_form_no=?, delivery_form_no=?, status_id=?, currency=?, tax_rate_bp=?, subtotal_minor=?, discount_minor=?, tax_minor=?, grand_total_minor=?, notes=?, confirmed_at = CASE WHEN ? THEN COALESCE(confirmed_at, datetime('now')) ELSE confirmed_at END, updated_at=datetime('now') WHERE id=? AND deleted_at IS NULL",
            )
            .run(...values, isConfirmedStatus ? 1 : 0, id),
          id)

    db.prepare('DELETE FROM record_items WHERE record_id = ?').run(recordId)
    const insertItem = db.prepare(
      'INSERT INTO record_items (record_id, line_no, description, quantity_x100, unit_price_minor, line_total_minor) VALUES (?, ?, ?, ?, ?, ?)',
    )
    items.forEach((item, index) =>
      insertItem.run(
        recordId,
        index + 1,
        item.description.trim(),
        item.quantity * 100,
        item.unitPrice,
        item.quantity * item.unitPrice,
      ),
    )
    syncCompletedOrders(db)
    writeAudit(db, userId, id === null ? 'record.create' : 'record.update', 'record', recordId, {
      input,
      itemCount: items.length,
    })
    return recordId
  })()
}

export function nextRecordNumber(db: Database.Database) {
  const rows = db
    .prepare("SELECT record_number FROM records WHERE record_number GLOB 'ORD-[0-9]*' OR record_number GLOB 'REC-[0-9]*'")
    .all() as { record_number: string }[]
  const highest = rows.reduce((max, row) => Math.max(max, Number(row.record_number.slice(4)) || 0), 0)
  return `ORD-${String(highest + 1).padStart(4, '0')}`
}

export function legacyRecordCount(db: Database.Database) {
  return (db.prepare('SELECT COUNT(*) AS count FROM records').get() as { count: number }).count
}

export function clearRecords(db: Database.Database) {
  return db.transaction(() => {
    db.prepare('DELETE FROM record_items').run()
    db.prepare("DELETE FROM audit_log WHERE entity = 'record'").run()
    return db.prepare('DELETE FROM records').run().changes
  })()
}

export type RecordListOptions = {
  search?: string
  filter?: string
  dateFrom?: string
  dateTo?: string
  status?: string
  page?: number
  pageSize?: number
}

export function listRecords(db: Database.Database, options: RecordListOptions = {}) {
  syncCompletedOrders(db)
  const search = options.search ?? ''
  const filter = options.filter ?? ''
  const pageSize = Math.max(10, Math.min(Number(options.pageSize) || 25, 100))
  const page = Math.max(1, Number(options.page) || 1)
  const offset = (page - 1) * pageSize
  const term = `%${search.trim()}%`
  const workflow =
    filter === 'unpaid'
      ? 'AND r.grand_total_minor>COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.record_id=r.id),0)'
      : filter === 'delivery'
        ? "AND r.confirmed_at IS NOT NULL AND r.delivered_at IS NULL AND (r.delivery_form_no IS NULL OR r.delivery_form_no = '') AND r.event_date <= date('now', '+3 days')"
        : filter.startsWith('status:')
          ? `AND s.name = '${filter.slice(7).replace(/'/g, "''")}'`
          : ''
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(options.dateFrom ?? '') ? options.dateFrom : ''
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(options.dateTo ?? '') ? options.dateTo : ''
  const status = options.status?.trim() ?? ''
  const conditions = `WHERE r.deleted_at IS NULL AND (r.client_name LIKE ? COLLATE NOCASE OR r.record_number LIKE ? COLLATE NOCASE OR r.invoice_no LIKE ? COLLATE NOCASE)
    ${dateFrom ? 'AND r.record_date >= ?' : ''} ${dateTo ? 'AND r.record_date <= ?' : ''} ${status ? 'AND s.name = ?' : ''} ${workflow}`
  const params = [
    term,
    term,
    term,
    ...(dateFrom ? [dateFrom] : []),
    ...(dateTo ? [dateTo] : []),
    ...(status ? [status] : []),
  ]
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM records r JOIN statuses s ON s.id = r.status_id ${conditions}`).get(
      ...params,
    ) as { count: number }
  ).count
  const rows = db
    .prepare(
      `SELECT r.*, s.name AS status_name, s.color AS status_color,
    COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.record_id=r.id),0) AS paid_minor,
    CASE WHEN COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.record_id=r.id),0)<=0 THEN 'Pending'
         WHEN COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.record_id=r.id),0)<r.grand_total_minor THEN 'Partially Paid'
         ELSE 'Fully Paid' END AS payment_status
    FROM records r JOIN statuses s ON s.id = r.status_id
    ${conditions} ORDER BY r.record_date DESC, r.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset)
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export function updateWorkflow(
  db: Database.Database,
  id: number,
  stage: 'confirmed' | 'paid' | 'delivered',
  enabled: boolean,
  userId: number | null,
) {
  const column = `${stage}_at`
  const record = db.prepare('SELECT * FROM records WHERE id = ? AND deleted_at IS NULL').get(id) as
    | Record<string, unknown>
    | undefined
  if (!record) throw new Error('INVALID_INPUT')
  if (enabled && stage === 'confirmed') {
    const item = db
      .prepare(
        'SELECT COUNT(*) AS count FROM record_items WHERE record_id = ? AND description <> "" AND quantity_x100 > 0 AND unit_price_minor >= 0',
      )
      .get(id) as { count: number }
    if (
      !String(record.client_name ?? '').trim() ||
      !record.record_date ||
      !record.event_date ||
      !item.count ||
      Number(record.grand_total_minor) <= 0
    )
      throw new Error('CONFIRMATION_REQUIREMENTS')
  }
  if (enabled && stage === 'paid' && !record.confirmed_at) throw new Error('CONFIRM_BEFORE_PAYMENT')
  if (enabled && stage === 'delivered' && !record.paid_at) throw new Error('PAY_BEFORE_DELIVERY')
  if (!enabled && stage === 'confirmed' && (record.paid_at || record.delivered_at))
    throw new Error('CLEAR_LATER_STAGES_FIRST')
  if (!enabled && stage === 'paid' && record.delivered_at) throw new Error('CLEAR_LATER_STAGES_FIRST')
  db.prepare(`UPDATE records SET ${column} = ?, updated_at = datetime('now') WHERE id = ?`).run(
    enabled ? new Date().toISOString() : null,
    id,
  )
  syncCompletedOrders(db)
  writeAudit(db, userId, `record.${stage}.${enabled ? 'set' : 'clear'}`, 'record', id, {})
  return true
}

export function getRecord(db: Database.Database, id: number) {
  syncCompletedOrders(db)
  const record = db.prepare('SELECT * FROM records WHERE id = ? AND deleted_at IS NULL').get(id)
  if (!record) return null
  const items = db.prepare('SELECT * FROM record_items WHERE record_id = ? ORDER BY line_no').all(id)
  return { record, items }
}

export function softDeleteRecord(db: Database.Database, id: number, userId: number | null) {
  const result = db.prepare("UPDATE records SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL").run(id)
  if (result.changes) writeAudit(db, userId, 'record.delete', 'record', id, {})
  return result.changes
}
