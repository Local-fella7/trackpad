import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { migrations } from '../electron/db/migrations'
import {
  amendProformaToInvoice,
  createDeliveryNoteFromOrder,
  createOrderFormFromOrder,
  createProformaFromOrder,
  getDocument,
  getSequenceStatus,
  listDocuments,
  listOrdersWithoutDocument,
  setSequenceStart,
} from '../electron/db/repos/documents'
import { getRecord, saveRecord } from '../electron/db/repos/records'
import { addPayment } from '../electron/db/repos/payments'
import { getDashboardData } from '../electron/dashboard'
import { buildDocumentHtml } from '../shared/document-templates'

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const sql of migrations) {
    db.exec(sql)
  }
  return db
}

function seedOrder(db: Database.Database, clientName: string, totalItems = [{ description: 'Tents', quantity: 4, unitPrice: 100000 }]) {
  const pendingStatus = db.prepare("SELECT id FROM statuses WHERE LOWER(name) = 'pending'").get() as { id: number }
  return saveRecord(
    db,
    null,
    {
      recordDate: '2026-11-12',
      recordNumber: `ORD-${Math.floor(1000 + Math.random() * 8999)}`,
      clientName,
      contacts: '+255 754 785 589',
      location: 'MOSHONO (ST. JUDE MOIVARO)',
      eventDate: '2026-11-22',
      statusId: pendingStatus.id,
      currency: 'TZS',
    },
    totalItems,
    null,
  )
}

describe('Documents repository & safe auto-numbering', () => {
  it('requires start number before first proforma, then increments and shares sequence with amended invoices', () => {
    const db = createTestDb()
    const order1 = seedOrder(db, 'MADAM BEATHA', [
      { description: 'Tents', quantity: 4, unitPrice: 100000 },
      { description: 'Round tables with white table cloths', quantity: 15, unitPrice: 7000 },
    ])
    const order2 = seedOrder(db, 'OLIVE GARDEN', [
      { description: 'Banquet chairs', quantity: 100, unitPrice: 1800 },
    ])

    expect(getSequenceStatus(db, 'proforma_invoice').configured).toBe(false)
    expect(listOrdersWithoutDocument(db, 'proforma').length).toBe(2)

    expect(() => createProformaFromOrder(db, { recordId: order1 }, null)).toThrow('SEQUENCE_NOT_CONFIGURED')

    const seq = setSequenceStart(db, 'proforma_invoice', 948)
    expect(seq.configured).toBe(true)
    expect(seq.nextFormatted).toBe('0948')

    // First Proforma -> 0948
    const p1 = createProformaFromOrder(db, { recordId: order1, issueDate: '2026-11-12' }, null)
    expect(p1.doc_type).toBe('proforma')
    expect(p1.doc_number).toBe('0948')
    expect(p1.grand_total_minor).toBe(505000)
    expect(listOrdersWithoutDocument(db, 'proforma').length).toBe(1)

    // Second Proforma -> 0949
    const p2 = createProformaFromOrder(db, { recordId: order2, issueDate: '2026-11-12' }, null)
    expect(p2.doc_type).toBe('proforma')
    expect(p2.doc_number).toBe('0949')
    expect(listOrdersWithoutDocument(db, 'proforma').length).toBe(0)

    // Amend Proforma 0948 -> raises INVOICE 0950 (since 0949 is already taken)
    const inv = amendProformaToInvoice(
      db,
      {
        sourceDocumentId: p1.id,
        issueDate: '2026-11-15',
        items: [
          { description: 'Tents', quantity: 4, unitPrice: 100000 },
          { description: 'Round tables with white table cloths', quantity: 15, unitPrice: 7000 },
          { description: 'Banquet chairs with black covers', quantity: 100, unitPrice: null, lineTotal: 180000, isLumpSum: true },
          { description: 'Transport go and return', quantity: null, unitPrice: null, lineTotal: 60000, isLumpSum: true },
        ],
      },
      null,
    )

    expect(inv.doc_type).toBe('invoice')
    expect(inv.doc_number).toBe('0950')
    expect(inv.parent_document_id).toBe(p1.id)
    expect(inv.parent_doc_number).toBe('0948')
    expect(inv.grand_total_minor).toBe(745000)

    // Original Proforma 0948 snapshot remains intact
    const origP1 = getDocument(db, p1.id)!
    expect(origP1.grand_total_minor).toBe(505000)
    expect(origP1.items.length).toBe(2)

    // Linked order synced with invoice_no = 0950 and new grand total, while keeping proforma_no = 0948
    const updatedOrder1 = getRecord(db, order1)!
    expect((updatedOrder1.record as any).proforma_no).toBe('0948')
    expect((updatedOrder1.record as any).invoice_no).toBe('0950')
    expect((updatedOrder1.record as any).grand_total_minor).toBe(745000)
    expect(updatedOrder1.items.length).toBe(4)

    // Safe reset to an earlier number (947) skips 0948, 0949, 0950 automatically!
    const order3 = seedOrder(db, 'CLIENT THREE')
    const order4 = seedOrder(db, 'CLIENT FOUR')
    const resetSeq = setSequenceStart(db, 'proforma_invoice', 947)
    expect(resetSeq.nextFormatted).toBe('0947')

    const p3 = createProformaFromOrder(db, { recordId: order3 }, null)
    expect(p3.doc_number).toBe('0947')

    const p4 = createProformaFromOrder(db, { recordId: order4 }, null)
    expect(p4.doc_number).toBe('0951')

    expect(listDocuments(db, { sequenceGroup: 'proforma_invoice' }).length).toBe(5)
    db.close()
  })

  it('generates Customer Order Forms and Delivery Notes with independent sequences and syncs records', () => {
    const db = createTestDb()
    const orderId = seedOrder(db, 'OLIVE GARDEN', [
      { description: 'Tents', quantity: 11, unitPrice: 100000 },
      { description: 'Banquet chairs', quantity: 15, unitPrice: 2000 },
    ])

    setSequenceStart(db, 'order_form', 498)
    setSequenceStart(db, 'delivery_note', 783)

    const orderForm = createOrderFormFromOrder(
      db,
      {
        recordId: orderId,
        altPhone: '+255 700 000 001',
        setupDate: '2026-11-07',
        takedownDate: '2026-11-08',
        eventColors: 'Gold & White',
        showPrices: false,
      },
      null,
    )
    expect(orderForm.doc_number).toBe('0498')
    expect(orderForm.show_prices).toBe(0)
    expect(orderForm.event_colors).toBe('Gold & White')

    const deliveryNote = createDeliveryNoteFromOrder(
      db,
      {
        recordId: orderId,
        issueDate: '2026-11-06',
        showPrices: false,
      },
      null,
    )
    expect(deliveryNote.doc_number).toBe('0783')
    expect(deliveryNote.show_prices).toBe(0)

    const rec = getRecord(db, orderId)!.record as any
    expect(rec.order_form_no).toBe('0498')
    expect(rec.delivery_form_no).toBe('0783')

    // Verify HTML template rendering
    const assets = { headerSrc: '/branding/ms-header.png', footerSrc: '/branding/ms-footer.png' }
    const orderHtml = buildDocumentHtml(orderForm, assets)
    expect(orderHtml).toContain('CUSTOMER ORDER FORM')
    expect(orderHtml).toContain('NO: 0498')
    expect(orderHtml).toContain('20% non-refundable deposit')
    expect(orderHtml).toContain('Gold &amp; White')
    expect(orderHtml).not.toContain('100,000/=')

    const deliveryHtml = buildDocumentHtml(deliveryNote, assets)
    expect(deliveryHtml).toContain('DELIVERY NOTE')
    expect(deliveryHtml).toContain('NO: 0783')
    expect(deliveryHtml).toContain('TIN: 117-922-650')
    expect(deliveryHtml).toContain('Delivered by / Imetolewa na:')
    expect(deliveryHtml).toContain('Received by / Imepokelewa:')
    expect(deliveryHtml).toContain('/branding/ms-header.png')
    expect(deliveryHtml).toContain('/branding/ms-footer.png')

    db.close()
  })

  it('scopes overview KPI totals to the selected month when switching months', () => {
    const db = createTestDb()
    const pendingStatus = db.prepare("SELECT id FROM statuses WHERE LOWER(name) = 'pending'").get() as { id: number }

    const novOrder = saveRecord(
      db,
      null,
      {
        recordDate: '2026-11-10',
        recordNumber: 'ORD-0001',
        clientName: 'November Client',
        eventDate: '2026-11-22',
        statusId: pendingStatus.id,
        currency: 'TZS',
      },
      [{ description: 'Tents', quantity: 4, unitPrice: 100000 }],
      null,
    )
    addPayment(db, { recordId: novOrder, amountMinor: 150000, paymentDate: '2026-11-11', method: 'CRDB' })

    const decOrder = saveRecord(
      db,
      null,
      {
        recordDate: '2026-11-15',
        recordNumber: 'ORD-0002',
        clientName: 'December Client',
        eventDate: '2026-12-18',
        statusId: pendingStatus.id,
        currency: 'TZS',
      },
      [{ description: 'Decor Package', quantity: 1, unitPrice: 1000000 }],
      null,
    )
    addPayment(db, { recordId: decOrder, amountMinor: 500000, paymentDate: '2026-11-16', method: 'NMB' })

    const novData = getDashboardData(db, '2026-11-23', 30, '2026-11')
    expect((novData.monthSummary[0] as any).total).toBe(400000)
    expect(novData.paidTotal).toBe(150000)
    expect(novData.outstandingTotal).toBe(250000)
    expect(novData.monthOrderCount).toBe(1)

    const decData = getDashboardData(db, '2026-11-23', 30, '2026-12')
    expect((decData.monthSummary[0] as any).total).toBe(1000000)
    expect(decData.paidTotal).toBe(500000)
    expect(decData.outstandingTotal).toBe(500000)
    expect(decData.monthOrderCount).toBe(1)
    expect(decData.previousMonthTotal).toBe(400000)

    db.close()
  })
})
