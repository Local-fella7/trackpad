import type Database from 'better-sqlite3'
import type {
  AmendProformaInput,
  CreateDeliveryNoteInput,
  CreateOrderFormInput,
  CreateProformaInput,
  DocumentLineItem,
  DocumentRecord,
  DocumentType,
  PendingOrderRow,
  SequenceGroup,
  SequenceStatus,
} from '../../../shared/document-types'
import { writeAudit } from './audit'
import { syncCompletedOrders } from './records'

const SEQUENCE_GROUPS: readonly SequenceGroup[] = ['proforma_invoice', 'order_form', 'delivery_note']

export function formatDocNumber(num: number): string {
  return String(Math.max(1, Math.floor(num))).padStart(4, '0')
}

function extractTrailingInt(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const match = String(raw).trim().match(/(\d+)$/)
  if (!match) return null
  const parsed = Number.parseInt(match[1]!, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function collectUsedNumbers(db: Database.Database, sequenceGroup: SequenceGroup): Set<number> {
  const used = new Set<number>()

  const docRows = db
    .prepare('SELECT doc_number_int FROM documents WHERE sequence_group = ?')
    .all(sequenceGroup) as { doc_number_int: number }[]
  for (const row of docRows) {
    if (Number.isInteger(row.doc_number_int) && row.doc_number_int > 0) used.add(row.doc_number_int)
  }

  if (sequenceGroup === 'proforma_invoice') {
    const legacy = db
      .prepare('SELECT proforma_no, invoice_no FROM records WHERE deleted_at IS NULL')
      .all() as { proforma_no: string | null; invoice_no: string | null }[]
    for (const row of legacy) {
      const p = extractTrailingInt(row.proforma_no)
      if (p) used.add(p)
      const inv = extractTrailingInt(row.invoice_no)
      if (inv) used.add(inv)
    }
  } else if (sequenceGroup === 'order_form') {
    const legacy = db
      .prepare('SELECT order_form_no FROM records WHERE deleted_at IS NULL AND order_form_no IS NOT NULL')
      .all() as { order_form_no: string | null }[]
    for (const row of legacy) {
      const n = extractTrailingInt(row.order_form_no)
      if (n) used.add(n)
    }
  } else if (sequenceGroup === 'delivery_note') {
    const legacy = db
      .prepare('SELECT delivery_form_no FROM records WHERE deleted_at IS NULL AND delivery_form_no IS NOT NULL')
      .all() as { delivery_form_no: string | null }[]
    for (const row of legacy) {
      const n = extractTrailingInt(row.delivery_form_no)
      if (n) used.add(n)
    }
  }

  return used
}

export function findNextAvailableNumber(
  db: Database.Database,
  sequenceGroup: SequenceGroup,
  fromNumber: number,
): number {
  const used = collectUsedNumbers(db, sequenceGroup)
  let candidate = Math.max(1, Math.floor(fromNumber))
  while (used.has(candidate)) {
    candidate += 1
  }
  return candidate
}

export function getSequenceStatus(db: Database.Database, sequenceGroup: SequenceGroup): SequenceStatus {
  if (!SEQUENCE_GROUPS.includes(sequenceGroup)) throw new Error('INVALID_INPUT')
  const row = db
    .prepare('SELECT start_number, next_number FROM document_sequences WHERE sequence_group = ?')
    .get(sequenceGroup) as { start_number: number | null; next_number: number | null } | undefined

  if (!row || row.start_number === null || row.next_number === null) {
    return {
      sequenceGroup,
      configured: false,
      startNumber: null,
      nextNumber: null,
      nextFormatted: null,
    }
  }

  const nextAvailable = findNextAvailableNumber(db, sequenceGroup, row.next_number)
  return {
    sequenceGroup,
    configured: true,
    startNumber: row.start_number,
    nextNumber: nextAvailable,
    nextFormatted: formatDocNumber(nextAvailable),
  }
}

export function setSequenceStart(
  db: Database.Database,
  sequenceGroup: SequenceGroup,
  startNumber: number,
  userId: number | null = null,
): SequenceStatus {
  if (!SEQUENCE_GROUPS.includes(sequenceGroup)) throw new Error('INVALID_INPUT')
  const parsed = Math.floor(Number(startNumber))
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 9999999) {
    throw new Error('INVALID_SEQUENCE_START')
  }

  return db.transaction(() => {
    const nextAvailable = findNextAvailableNumber(db, sequenceGroup, parsed)
    db.prepare(
      `INSERT INTO document_sequences (sequence_group, start_number, next_number, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(sequence_group) DO UPDATE SET
         start_number = excluded.start_number,
         next_number = excluded.next_number,
         updated_at = datetime('now')`,
    ).run(sequenceGroup, parsed, nextAvailable)

    writeAudit(db, userId, 'document.sequence.set', 'document_sequence', null, {
      sequenceGroup,
      startNumber: parsed,
      nextAvailable,
    })

    return {
      sequenceGroup,
      configured: true,
      startNumber: parsed,
      nextNumber: nextAvailable,
      nextFormatted: formatDocNumber(nextAvailable),
    }
  })()
}

function allocateNextNumber(db: Database.Database, sequenceGroup: SequenceGroup): { num: number; formatted: string } {
  const row = db
    .prepare('SELECT start_number, next_number FROM document_sequences WHERE sequence_group = ?')
    .get(sequenceGroup) as { start_number: number | null; next_number: number | null } | undefined

  if (!row || row.next_number === null) {
    throw new Error('SEQUENCE_NOT_CONFIGURED')
  }

  const assigned = findNextAvailableNumber(db, sequenceGroup, row.next_number)
  const nextCursor = findNextAvailableNumber(db, sequenceGroup, assigned + 1)

  db.prepare(
    "UPDATE document_sequences SET next_number = ?, updated_at = datetime('now') WHERE sequence_group = ?",
  ).run(nextCursor, sequenceGroup)

  return { num: assigned, formatted: formatDocNumber(assigned) }
}

function hydrateDocument(row: any): DocumentRecord {
  let items: DocumentLineItem[] = []
  try {
    const parsed = JSON.parse(String(row.items_json || '[]'))
    if (Array.isArray(parsed)) items = parsed
  } catch {
    items = []
  }
  const { items_json: _ignored, ...rest } = row
  return { ...rest, items }
}

function loadOrderWithItems(db: Database.Database, recordId: number) {
  const record = db
    .prepare('SELECT * FROM records WHERE id = ? AND deleted_at IS NULL')
    .get(recordId) as Record<string, any> | undefined
  if (!record) throw new Error('ORDER_NOT_FOUND')

  const rawItems = db
    .prepare('SELECT * FROM record_items WHERE record_id = ? ORDER BY line_no')
    .all(recordId) as Record<string, any>[]

  const items: DocumentLineItem[] = rawItems.map(i => {
    const qty = Number(i.quantity_x100 || 0) / 100
    const unitPrice = Number(i.unit_price_minor || 0)
    const lineTotal = Number(i.line_total_minor ?? Math.round(qty * unitPrice))
    return {
      description: String(i.description || ''),
      quantity: qty,
      unitPrice,
      lineTotal,
      isLumpSum: false,
    }
  })

  return { record, items }
}

export function listOrdersWithoutDocument(
  db: Database.Database,
  docKind: 'proforma' | 'order_form' | 'delivery_note',
  search = '',
): PendingOrderRow[] {
  syncCompletedOrders(db)
  const col =
    docKind === 'proforma'
      ? 'proforma_no'
      : docKind === 'order_form'
        ? 'order_form_no'
        : 'delivery_form_no'

  const term = `%${search.trim()}%`
  return db
    .prepare(
      `SELECT r.id, r.record_number, r.record_date, r.client_name, r.contacts, r.location, r.event_date,
              r.proforma_no, r.invoice_no, r.order_form_no, r.delivery_form_no,
              r.subtotal_minor, r.discount_minor, r.grand_total_minor,
              s.name AS status_name, s.color AS status_color,
              (SELECT COUNT(*) FROM record_items ri WHERE ri.record_id = r.id) AS item_count
       FROM records r
       JOIN statuses s ON s.id = r.status_id
       WHERE r.deleted_at IS NULL
         AND LOWER(s.name) <> 'cancelled'
         AND (r.${col} IS NULL OR TRIM(r.${col}) = '')
         AND (r.client_name LIKE ? COLLATE NOCASE OR COALESCE(r.record_number, '') LIKE ? COLLATE NOCASE OR COALESCE(r.location, '') LIKE ? COLLATE NOCASE)
       ORDER BY r.record_date DESC, r.id DESC`,
    )
    .all(term, term, term) as PendingOrderRow[]
}

export function listDocuments(
  db: Database.Database,
  options: { sequenceGroup?: SequenceGroup; docTypes?: DocumentType[]; search?: string } = {},
): DocumentRecord[] {
  const conditions: string[] = ['1=1']
  const params: unknown[] = []

  if (options.sequenceGroup) {
    conditions.push('d.sequence_group = ?')
    params.push(options.sequenceGroup)
  }
  if (options.docTypes && options.docTypes.length > 0) {
    conditions.push(`d.doc_type IN (${options.docTypes.map(() => '?').join(',')})`)
    params.push(...options.docTypes)
  }
  if (options.search?.trim()) {
    const term = `%${options.search.trim()}%`
    conditions.push(
      '(d.client_name LIKE ? COLLATE NOCASE OR d.doc_number LIKE ? COLLATE NOCASE OR COALESCE(r.record_number, "") LIKE ? COLLATE NOCASE OR COALESCE(d.location, "") LIKE ? COLLATE NOCASE)',
    )
    params.push(term, term, term, term)
  }

  const rows = db
    .prepare(
      `SELECT d.*,
              r.record_number,
              p.doc_number AS parent_doc_number,
              p.doc_type AS parent_doc_type
       FROM documents d
       LEFT JOIN records r ON r.id = d.record_id
       LEFT JOIN documents p ON p.id = d.parent_document_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.id DESC`,
    )
    .all(...params)

  return rows.map(hydrateDocument)
}

export function getDocument(db: Database.Database, id: number): DocumentRecord | null {
  const row = db
    .prepare(
      `SELECT d.*,
              r.record_number,
              p.doc_number AS parent_doc_number,
              p.doc_type AS parent_doc_type
       FROM documents d
       LEFT JOIN records r ON r.id = d.record_id
       LEFT JOIN documents p ON p.id = d.parent_document_id
       WHERE d.id = ?`,
    )
    .get(id)
  return row ? hydrateDocument(row) : null
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function createProformaFromOrder(
  db: Database.Database,
  input: CreateProformaInput,
  userId: number | null,
): DocumentRecord {
  return db.transaction(() => {
    const { record, items } = loadOrderWithItems(db, input.recordId)
    if (!items.length) throw new Error('ORDER_HAS_NO_ITEMS')

    const { num, formatted } = allocateNextNumber(db, 'proforma_invoice')
    const issueDate = input.issueDate?.trim() || todayIso()
    const notes = input.notes !== undefined ? input.notes.trim() || null : record.notes || null

    const result = db
      .prepare(
        `INSERT INTO documents (
          doc_type, sequence_group, doc_number, doc_number_int, record_id, parent_document_id,
          issue_date, client_name, client_phone, location, event_date,
          show_prices, subtotal_minor, discount_minor, grand_total_minor, notes, items_json, created_by
        ) VALUES ('proforma', 'proforma_invoice', ?, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        formatted,
        num,
        record.id,
        issueDate,
        record.client_name,
        record.contacts || null,
        record.location || null,
        record.event_date || null,
        Number(record.subtotal_minor || 0),
        Number(record.discount_minor || 0),
        Number(record.grand_total_minor || 0),
        notes,
        JSON.stringify(items),
        userId,
      )

    db.prepare("UPDATE records SET proforma_no = ?, updated_at = datetime('now') WHERE id = ?").run(
      formatted,
      record.id,
    )

    const docId = Number(result.lastInsertRowid)
    writeAudit(db, userId, 'document.proforma.create', 'document', docId, {
      recordId: record.id,
      docNumber: formatted,
    })

    return getDocument(db, docId)!
  })()
}

export function amendProformaToInvoice(
  db: Database.Database,
  input: AmendProformaInput,
  userId: number | null,
): DocumentRecord {
  return db.transaction(() => {
    const source = getDocument(db, input.sourceDocumentId)
    if (!source || !['proforma', 'invoice'].includes(source.doc_type)) {
      throw new Error('DOCUMENT_NOT_FOUND')
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error('INVALID_RECORD')
    }

    const normalizedItems: DocumentLineItem[] = input.items.map(raw => {
      const description = String(raw.description || '').trim()
      if (!description) throw new Error('INVALID_RECORD')

      const isLumpSum = Boolean(raw.isLumpSum)
      if (isLumpSum) {
        const lineTotal = Math.max(0, Math.round(Number(raw.lineTotal ?? raw.unitPrice ?? 0)))
        const qty = raw.quantity !== null && raw.quantity !== undefined && Number(raw.quantity) > 0 ? Number(raw.quantity) : null
        return { description, quantity: qty, unitPrice: null, lineTotal, isLumpSum: true }
      }

      const quantity = Number(raw.quantity || 0)
      const unitPrice = Math.max(0, Math.round(Number(raw.unitPrice || 0)))
      if (quantity <= 0) throw new Error('INVALID_RECORD')
      const lineTotal = Math.round(quantity * unitPrice)
      return { description, quantity, unitPrice, lineTotal, isLumpSum: false }
    })

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0)
    const discount = Math.max(0, Math.min(subtotal, Math.round(Number(input.discountMinor ?? source.discount_minor ?? 0))))
    const grandTotal = Math.max(0, subtotal - discount)

    const { num, formatted } = allocateNextNumber(db, 'proforma_invoice')
    const issueDate = input.issueDate?.trim() || todayIso()
    const notes = input.notes !== undefined ? input.notes.trim() || null : source.notes

    const result = db
      .prepare(
        `INSERT INTO documents (
          doc_type, sequence_group, doc_number, doc_number_int, record_id, parent_document_id,
          issue_date, client_name, client_phone, location, event_date,
          show_prices, subtotal_minor, discount_minor, grand_total_minor, notes, items_json, created_by
        ) VALUES ('invoice', 'proforma_invoice', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        formatted,
        num,
        source.record_id,
        source.id,
        issueDate,
        source.client_name,
        source.client_phone,
        source.location,
        source.event_date,
        subtotal,
        discount,
        grandTotal,
        notes,
        JSON.stringify(normalizedItems),
        userId,
      )

    // Sync the linked order's invoice_no, items, and totals while preserving proforma_no
    db.prepare(
      `UPDATE records
       SET invoice_no = ?, subtotal_minor = ?, discount_minor = ?, grand_total_minor = ?, updated_at = datetime('now')
       WHERE id = ? AND deleted_at IS NULL`,
    ).run(formatted, subtotal, discount, grandTotal, source.record_id)

    db.prepare('DELETE FROM record_items WHERE record_id = ?').run(source.record_id)
    const insertItem = db.prepare(
      'INSERT INTO record_items (record_id, line_no, description, quantity_x100, unit_price_minor, line_total_minor) VALUES (?, ?, ?, ?, ?, ?)',
    )
    normalizedItems.forEach((item, idx) => {
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1
      const unitPrice = item.isLumpSum ? Math.round(item.lineTotal / qty) : Number(item.unitPrice || 0)
      insertItem.run(source.record_id, idx + 1, item.description, Math.round(qty * 100), unitPrice, item.lineTotal)
    })

    syncCompletedOrders(db)

    const docId = Number(result.lastInsertRowid)
    writeAudit(db, userId, 'document.invoice.amend', 'document', docId, {
      recordId: source.record_id,
      parentDocumentId: source.id,
      parentDocNumber: source.doc_number,
      docNumber: formatted,
      grandTotal,
    })

    return getDocument(db, docId)!
  })()
}

export function createOrderFormFromOrder(
  db: Database.Database,
  input: CreateOrderFormInput,
  userId: number | null,
): DocumentRecord {
  return db.transaction(() => {
    const { record, items } = loadOrderWithItems(db, input.recordId)
    if (!items.length) throw new Error('ORDER_HAS_NO_ITEMS')

    const { num, formatted } = allocateNextNumber(db, 'order_form')
    const issueDate = input.issueDate?.trim() || todayIso()
    const showPrices = input.showPrices ? 1 : 0

    const result = db
      .prepare(
        `INSERT INTO documents (
          doc_type, sequence_group, doc_number, doc_number_int, record_id, parent_document_id,
          issue_date, client_name, client_phone, alt_phone, location, event_date,
          setup_date, takedown_date, event_colors,
          show_prices, subtotal_minor, discount_minor, grand_total_minor, notes, items_json, created_by
        ) VALUES ('order_form', 'order_form', ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        formatted,
        num,
        record.id,
        issueDate,
        record.client_name,
        record.contacts || null,
        input.altPhone?.trim() || null,
        record.location || null,
        record.event_date || null,
        input.setupDate?.trim() || null,
        input.takedownDate?.trim() || null,
        input.eventColors?.trim() || null,
        showPrices,
        Number(record.subtotal_minor || 0),
        Number(record.discount_minor || 0),
        Number(record.grand_total_minor || 0),
        input.notes !== undefined ? input.notes.trim() || null : record.notes || null,
        JSON.stringify(items),
        userId,
      )

    db.prepare("UPDATE records SET order_form_no = ?, updated_at = datetime('now') WHERE id = ?").run(
      formatted,
      record.id,
    )

    const docId = Number(result.lastInsertRowid)
    writeAudit(db, userId, 'document.order_form.create', 'document', docId, {
      recordId: record.id,
      docNumber: formatted,
    })

    return getDocument(db, docId)!
  })()
}

export function createDeliveryNoteFromOrder(
  db: Database.Database,
  input: CreateDeliveryNoteInput,
  userId: number | null,
): DocumentRecord {
  return db.transaction(() => {
    const { record, items } = loadOrderWithItems(db, input.recordId)
    if (!items.length) throw new Error('ORDER_HAS_NO_ITEMS')

    const { num, formatted } = allocateNextNumber(db, 'delivery_note')
    const issueDate = input.issueDate?.trim() || todayIso()
    const showPrices = input.showPrices ? 1 : 0

    const result = db
      .prepare(
        `INSERT INTO documents (
          doc_type, sequence_group, doc_number, doc_number_int, record_id, parent_document_id,
          issue_date, client_name, client_phone, location, event_date,
          show_prices, subtotal_minor, discount_minor, grand_total_minor, notes, items_json, created_by
        ) VALUES ('delivery_note', 'delivery_note', ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        formatted,
        num,
        record.id,
        issueDate,
        record.client_name,
        record.contacts || null,
        record.location || null,
        record.event_date || null,
        showPrices,
        Number(record.subtotal_minor || 0),
        Number(record.discount_minor || 0),
        Number(record.grand_total_minor || 0),
        input.notes !== undefined ? input.notes.trim() || null : record.notes || null,
        JSON.stringify(items),
        userId,
      )

    db.prepare("UPDATE records SET delivery_form_no = ?, updated_at = datetime('now') WHERE id = ?").run(
      formatted,
      record.id,
    )

    const docId = Number(result.lastInsertRowid)
    writeAudit(db, userId, 'document.delivery_note.create', 'document', docId, {
      recordId: record.id,
      docNumber: formatted,
    })

    return getDocument(db, docId)!
  })()
}
