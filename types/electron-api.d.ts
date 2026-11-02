export {}

declare global {
  interface Window {
    desktopProof?: {
      run: () => Promise<{ recordCount: number; pdfPath: string }>
    }
    api?: {
      auth: { status: () => Promise<any>; setup: (input: unknown) => Promise<any>; login: (input: unknown) => Promise<any>; recover: (input: unknown) => Promise<any>; logout: () => Promise<any> }
      records: {
        list: (input?: { search?: string }) => Promise<{ ok: boolean; data?: unknown[] }>
        create: (input: unknown) => Promise<{ ok: boolean; data?: number; error?: { message: string } }>
        get: (id: number) => Promise<any>; update: (input: unknown) => Promise<any>; remove: (id: number) => Promise<any>
      }
      statuses: { list: () => Promise<{ ok: boolean; data?: unknown[] }>; create: (input: unknown) => Promise<{ ok: boolean }> }
      settings: { get: () => Promise<{ ok: boolean; data?: Record<string, string> }>; set: (input: unknown) => Promise<{ ok: boolean }> }
      dashboard: { data: () => Promise<{ ok: boolean; data?: Record<string, unknown> }> }
    }
  }
}
