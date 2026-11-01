export {}

declare global {
  interface Window {
    desktopProof?: {
      run: () => Promise<{ recordCount: number; pdfPath: string }>
    }
  }
}
