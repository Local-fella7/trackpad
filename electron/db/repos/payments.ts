import type Database from 'better-sqlite3'
import { syncCompletedOrders } from './records'

export interface PaymentInput {
  recordId: number
  amountMinor: number
  paymentDate: string
  method?: string
  reference?: string
  notes?: string
}

export function listPayments(db: Database.Database, recordId: number) {
  return db.prepare('SELECT * FROM payments WHERE record_id = ? ORDER BY payment_date DESC, id DESC').all(recordId)
}

export function addPayment(db: Database.Database, input: PaymentInput) {
  const record = db
    .prepare('SELECT id, grand_total_minor FROM records WHERE id = ? AND deleted_at IS NULL')
    .get(input.recordId) as { id: number; grand_total_minor: number } | undefined
  if (!record) throw new Error('INVALID_INPUT')

  const amountMinor = Math.round(Number(input.amountMinor) || 0)
  if (amountMinor <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)) throw new Error('INVALID_PAYMENT')

  const paid = db
    .prepare('SELECT COALESCE(SUM(amount_minor), 0) AS total FROM payments WHERE record_id = ?')
    .get(input.recordId) as { total: number }
  if (paid.total + amountMinor > record.grand_total_minor) throw new Error('PAYMENT_EXCEEDS_BALANCE')

  const result = db
    .prepare(
      'INSERT INTO payments (record_id, amount_minor, payment_date, method, reference, notes) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      input.recordId,
      amountMinor,
      input.paymentDate,
      input.method?.trim() || null,
      input.reference?.trim() || null,
      input.notes?.trim() || null,
    )

  const total = paid.total + amountMinor
  if (total >= record.grand_total_minor) {
    db.prepare(
      "UPDATE records SET paid_at = COALESCE(paid_at, datetime('now')), updated_at = datetime('now') WHERE id = ?",
    ).run(input.recordId)
  }

  syncCompletedOrders(db)

  db.prepare("INSERT INTO audit_log (action, entity, entity_id, details) VALUES ('payment.recorded', 'record', ?, ?)").run(
    input.recordId,
    JSON.stringify({ paymentId: Number(result.lastInsertRowid), amountMinor, paymentDate: input.paymentDate }),
  )
  return Number(result.lastInsertRowid)
}

export function deletePayment(db: Database.Database, paymentId: number) {
  const payment = db.prepare('SELECT record_id FROM payments WHERE id = ?').get(paymentId) as
    | { record_id: number }
    | undefined
  if (!payment) throw new Error('INVALID_INPUT')

  db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId)
  const record = db.prepare('SELECT grand_total_minor FROM records WHERE id = ?').get(payment.record_id) as {
    grand_total_minor: number
  }
  const paid = db
    .prepare('SELECT COALESCE(SUM(amount_minor), 0) AS total FROM payments WHERE record_id = ?')
    .get(payment.record_id) as { total: number }

  if (paid.total < record.grand_total_minor) {
    db.prepare("UPDATE records SET paid_at = NULL, updated_at = datetime('now') WHERE id = ?").run(payment.record_id)
  }

  syncCompletedOrders(db)

  db.prepare("INSERT INTO audit_log (action, entity, entity_id, details) VALUES ('payment.deleted', 'record', ?, ?)").run(
    payment.record_id,
    JSON.stringify({ paymentId }),
  )
}

export function listBilling(db: Database.Database) {
  syncCompletedOrders(db)
  return db
    .prepare(
      `SELECT
        r.id,
        r.record_number,
        r.client_name,
        r.contacts,
        r.invoice_no,
        r.grand_total_minor,
        r.currency,
        r.record_date,
        r.event_date,
        s.name AS status_name,
        s.color AS status_color,
        COALESCE(SUM(p.amount_minor), 0) AS paid_minor,
        MAX(0, r.grand_total_minor - COALESCE(SUM(p.amount_minor), 0)) AS balance_minor,
        CASE
          WHEN COALESCE(SUM(p.amount_minor), 0) <= 0 THEN 'Pending'
          WHEN COALESCE(SUM(p.amount_minor), 0) < r.grand_total_minor THEN 'Partially Paid'
          ELSE 'Fully Paid'
        END AS payment_status
      FROM records r
      JOIN statuses s ON s.id = r.status_id
      LEFT JOIN payments p ON p.record_id = r.id
      WHERE r.deleted_at IS NULL AND r.grand_total_minor > 0
      GROUP BY r.id
      ORDER BY r.record_date DESC, r.id DESC`,
    )
    .all()
}
