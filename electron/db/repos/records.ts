import type Database from 'better-sqlite3'
import { calculateTotals } from '../../../shared/money'
import type { CurrencyCode, ItemInput } from '../../../shared/types'
import { writeAudit } from './audit'

export interface RecordInput {
  recordDate: string; recordNumber?: string; clientName: string; contacts?: string; location?: string; sourceOfInfo?: string
  proformaNo?: string; invoiceNo?: string; eventDate?: string; orderFormNo?: string; deliveryFormNo?: string
  statusId: number; currency: CurrencyCode; taxRateBasisPoints: number; notes?: string
}

const nullable = (value?: string) => value?.trim() || null

export function saveRecord(db: Database.Database, id: number | null, input: RecordInput, items: readonly ItemInput[], userId: number | null) {
  return db.transaction(() => {
    const totals = calculateTotals(items, input.taxRateBasisPoints)
    const values = [input.recordDate, nullable(input.recordNumber), input.clientName.trim(), nullable(input.contacts), nullable(input.location), nullable(input.sourceOfInfo), nullable(input.proformaNo), nullable(input.invoiceNo), nullable(input.eventDate), nullable(input.orderFormNo), nullable(input.deliveryFormNo), input.statusId, input.currency, input.taxRateBasisPoints, totals.subtotal, totals.tax, totals.grandTotal, nullable(input.notes)]
    const recordId = id === null
      ? Number(db.prepare('INSERT INTO records (record_date, record_number, client_name, contacts, location, source_of_info, proforma_no, invoice_no, event_date, order_form_no, delivery_form_no, status_id, currency, tax_rate_bp, subtotal_minor, tax_minor, grand_total_minor, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(...values).lastInsertRowid)
      : (db.prepare('UPDATE records SET record_date=?, record_number=?, client_name=?, contacts=?, location=?, source_of_info=?, proforma_no=?, invoice_no=?, event_date=?, order_form_no=?, delivery_form_no=?, status_id=?, currency=?, tax_rate_bp=?, subtotal_minor=?, tax_minor=?, grand_total_minor=?, notes=?, updated_at=datetime(\'now\') WHERE id=? AND deleted_at IS NULL').run(...values, id), id)
    db.prepare('DELETE FROM record_items WHERE record_id = ?').run(recordId)
    const insertItem = db.prepare('INSERT INTO record_items (record_id, line_no, description, quantity_x100, unit_price_minor, line_total_minor) VALUES (?, ?, ?, ?, ?, ?)')
    items.forEach((item, index) => insertItem.run(recordId, index + 1, item.description.trim(), item.quantity * 100, item.unitPrice, item.quantity * item.unitPrice))
    writeAudit(db, userId, id === null ? 'record.create' : 'record.update', 'record', recordId, { input, itemCount: items.length })
    return recordId
  })()
}

export function nextRecordNumber(db: Database.Database) {
  const rows = db.prepare("SELECT record_number FROM records WHERE record_number GLOB 'REC-[0-9]*'").all() as { record_number: string }[]
  const highest = rows.reduce((max, row) => Math.max(max, Number(row.record_number.slice(4)) || 0), 0)
  return `REC-${String(highest + 1).padStart(4, '0')}`
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

export function listRecords(db: Database.Database, search = '', limit = 50, offset = 0) {
  const term = `%${search.trim()}%`
  return db.prepare(`SELECT r.*, s.name AS status_name, s.color AS status_color
    FROM records r JOIN statuses s ON s.id = r.status_id
    WHERE r.deleted_at IS NULL AND (r.client_name LIKE ? COLLATE NOCASE OR r.record_number LIKE ? COLLATE NOCASE OR r.invoice_no LIKE ? COLLATE NOCASE)
    ORDER BY r.record_date DESC, r.id DESC LIMIT ? OFFSET ?`).all(term, term, term, limit, offset)
}

export function getRecord(db: Database.Database, id: number) {
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
