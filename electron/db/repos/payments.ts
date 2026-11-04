import type Database from 'better-sqlite3'

export interface PaymentInput { recordId: number; amountMinor: number; paymentDate: string; method?: string; reference?: string; notes?: string }

export function listPayments(db: Database.Database, recordId: number) {
  return db.prepare('SELECT * FROM payments WHERE record_id=? ORDER BY payment_date DESC, id DESC').all(recordId)
}

export function addPayment(db: Database.Database, input: PaymentInput) {
  const record = db.prepare('SELECT id, grand_total_minor FROM records WHERE id=? AND deleted_at IS NULL').get(input.recordId) as {id:number;grand_total_minor:number}|undefined
  if (!record) throw new Error('INVALID_INPUT')
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)) throw new Error('INVALID_PAYMENT')
  const paid = db.prepare('SELECT COALESCE(SUM(amount_minor),0) AS total FROM payments WHERE record_id=?').get(input.recordId) as {total:number}
  if (paid.total + input.amountMinor > record.grand_total_minor) throw new Error('PAYMENT_EXCEEDS_BALANCE')
  const result = db.prepare('INSERT INTO payments (record_id,amount_minor,payment_date,method,reference,notes) VALUES (?,?,?,?,?,?)')
    .run(input.recordId,input.amountMinor,input.paymentDate,input.method?.trim()||null,input.reference?.trim()||null,input.notes?.trim()||null)
  const total = paid.total + input.amountMinor
  if (total >= record.grand_total_minor) db.prepare('UPDATE records SET paid_at=COALESCE(paid_at,datetime("now")),updated_at=datetime("now") WHERE id=?').run(input.recordId)
  return Number(result.lastInsertRowid)
}

export function deletePayment(db: Database.Database, paymentId: number) {
  const payment = db.prepare('SELECT record_id FROM payments WHERE id=?').get(paymentId) as {record_id:number}|undefined
  if (!payment) throw new Error('INVALID_INPUT')
  db.prepare('DELETE FROM payments WHERE id=?').run(paymentId)
  const record = db.prepare('SELECT grand_total_minor FROM records WHERE id=?').get(payment.record_id) as {grand_total_minor:number}
  const paid = db.prepare('SELECT COALESCE(SUM(amount_minor),0) AS total FROM payments WHERE record_id=?').get(payment.record_id) as {total:number}
  if (paid.total < record.grand_total_minor) db.prepare('UPDATE records SET paid_at=NULL,updated_at=datetime("now") WHERE id=?').run(payment.record_id)
}

export function listBilling(db: Database.Database) {
  return db.prepare(`SELECT r.id,r.record_number,r.client_name,r.grand_total_minor,r.currency,r.record_date,
    COALESCE(SUM(p.amount_minor),0) AS paid_minor,
    CASE WHEN COALESCE(SUM(p.amount_minor),0)<=0 THEN 'Pending' WHEN COALESCE(SUM(p.amount_minor),0)<r.grand_total_minor THEN 'Partially Paid' ELSE 'Fully Paid' END AS payment_status
    FROM records r LEFT JOIN payments p ON p.record_id=r.id
    WHERE r.deleted_at IS NULL AND r.grand_total_minor>0
    GROUP BY r.id ORDER BY r.record_date DESC,r.id DESC`).all()
}
