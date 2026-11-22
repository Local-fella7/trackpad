export type DocumentType = 'proforma' | 'invoice' | 'order_form' | 'delivery_note'
export type SequenceGroup = 'proforma_invoice' | 'order_form' | 'delivery_note'

export interface DocumentLineItem {
  description: string
  quantity: number | null
  unitPrice: number | null
  lineTotal: number
  isLumpSum?: boolean
}

export interface DocumentRecord {
  id: number
  doc_type: DocumentType
  sequence_group: SequenceGroup
  doc_number: string
  doc_number_int: number
  record_id: number
  record_number?: string | null
  parent_document_id: number | null
  parent_doc_number?: string | null
  parent_doc_type?: DocumentType | null
  issue_date: string
  client_name: string
  client_phone: string | null
  alt_phone: string | null
  location: string | null
  event_date: string | null
  setup_date: string | null
  takedown_date: string | null
  event_colors: string | null
  show_prices: number
  subtotal_minor: number
  discount_minor: number
  grand_total_minor: number
  notes: string | null
  items: DocumentLineItem[]
  created_by: number | null
  created_at: string
}

export interface SequenceStatus {
  sequenceGroup: SequenceGroup
  configured: boolean
  startNumber: number | null
  nextNumber: number | null
  nextFormatted: string | null
}

export interface PendingOrderRow {
  id: number
  record_number: string | null
  record_date: string
  client_name: string
  contacts: string | null
  location: string | null
  event_date: string | null
  proforma_no: string | null
  invoice_no: string | null
  order_form_no: string | null
  delivery_form_no: string | null
  subtotal_minor: number
  discount_minor: number
  grand_total_minor: number
  status_name: string
  status_color: string
  item_count: number
}

export interface CreateProformaInput {
  recordId: number
  issueDate?: string
  notes?: string
}

export interface AmendProformaInput {
  sourceDocumentId: number
  issueDate?: string
  discountMinor?: number
  notes?: string
  items: Array<{
    description: string
    quantity: number | null
    unitPrice: number | null
    lineTotal?: number
    isLumpSum?: boolean
  }>
}

export interface CreateOrderFormInput {
  recordId: number
  issueDate?: string
  altPhone?: string
  setupDate?: string
  takedownDate?: string
  eventColors?: string
  showPrices?: boolean
  notes?: string
}

export interface CreateDeliveryNoteInput {
  recordId: number
  issueDate?: string
  showPrices?: boolean
  notes?: string
}
