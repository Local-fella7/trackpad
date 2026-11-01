export {}

declare global {
  interface Window {
    desktopProof?: {
      run: () => Promise<{ recordCount: number; pdfPath: string }>
    }
    api?: {
      records: {
        list: (input?: { search?: string }) => Promise<{ ok: boolean; data?: unknown[] }>
        create: (input: unknown) => Promise<{ ok: boolean; data?: number; error?: { message: string } }>
      }
    }
  }
}
