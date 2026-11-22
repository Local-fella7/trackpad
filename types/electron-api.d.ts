export {}

declare global {
  interface Window {
    desktopProof?: {
      run: () => Promise<{ recordCount: number; pdfPath: string }>
    }
    api?: {
      auth: { status: () => Promise<any>; setup: (input: unknown) => Promise<any>; login: (input: unknown) => Promise<any>; recover: (input: unknown) => Promise<any>; logout: () => Promise<any> }
      records: {
        list: (input?: { search?: string; filter?: string; dateFrom?: string; dateTo?: string; status?: string; page?: number; pageSize?: number }) => Promise<{ ok: boolean; data?: { rows: unknown[]; total: number; page: number; pageSize: number; totalPages: number } }>
        create: (input: unknown) => Promise<{ ok: boolean; data?: number; error?: { message: string } }>
        get: (id: number) => Promise<any>; update: (input: unknown) => Promise<any>; remove: (id: number) => Promise<any>; workflow: (input: unknown) => Promise<any>
        nextNumber: () => Promise<any>; legacyStatus: () => Promise<any>; clearLegacy: () => Promise<any>; keepLegacy: () => Promise<any>
      }
      statuses: { list: () => Promise<{ ok: boolean; data?: unknown[] }>; create: (input: unknown) => Promise<{ ok: boolean }> }
      settings: { get: () => Promise<{ ok: boolean; data?: Record<string, string> }>; set: (input: unknown) => Promise<{ ok: boolean }> }
      billing: { list: () => Promise<any>; payments: (recordId: number) => Promise<any>; add: (input: unknown) => Promise<any>; remove: (id: number) => Promise<any> }
      dashboard: { data: (input?: { days?: number; month?: string }) => Promise<{ ok: boolean; data?: Record<string, unknown> }> }
      reports: { data: (type: string, params?: unknown) => Promise<any>; exportExcel: (report: unknown) => Promise<any>; exportPdf: (report: unknown) => Promise<any>; print: (report: unknown) => Promise<any>; openFolder: (file: string) => Promise<any> }
      documents: {
        sequenceStatus: (sequenceGroup: 'proforma_invoice' | 'order_form' | 'delivery_note') => Promise<any>
        setSequenceStart: (input: { sequenceGroup: 'proforma_invoice' | 'order_form' | 'delivery_note'; startNumber: number }) => Promise<any>
        pendingOrders: (input: { docKind: 'proforma' | 'order_form' | 'delivery_note'; search?: string }) => Promise<any>
        list: (input?: { sequenceGroup?: 'proforma_invoice' | 'order_form' | 'delivery_note'; docTypes?: string[]; search?: string }) => Promise<any>
        get: (id: number) => Promise<any>
        createProforma: (input: unknown) => Promise<any>
        amendProforma: (input: unknown) => Promise<any>
        createOrderForm: (input: unknown) => Promise<any>
        createDeliveryNote: (input: unknown) => Promise<any>
        exportPdf: (id: number) => Promise<any>
        print: (id: number) => Promise<any>
      }
    }
  }
}
