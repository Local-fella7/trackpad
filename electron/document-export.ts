import { app, BrowserWindow, dialog, type BrowserWindow as MainWindow } from 'electron'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { buildDocumentHtml, type DocumentBrandingAssets } from '../shared/document-templates'
import type { DocumentRecord } from '../shared/document-types'

const documentsDirectory = () => path.join(app.getPath('documents'), 'Trackpad', 'Documents')

let cachedAssets: DocumentBrandingAssets | null = null

async function loadImageDataUri(fileName: string): Promise<string> {
  const candidates = [
    path.join(app.getAppPath(), '.output', 'public', 'branding', fileName),
    path.join(app.getAppPath(), 'public', 'branding', fileName),
    path.join(process.cwd(), 'public', 'branding', fileName),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const bytes = await readFile(candidate)
      return `data:image/png;base64,${bytes.toString('base64')}`
    }
  }
  return ''
}

export async function getBrandingAssets(): Promise<DocumentBrandingAssets> {
  if (cachedAssets && cachedAssets.headerSrc && cachedAssets.footerSrc) {
    return cachedAssets
  }
  const [headerSrc, footerSrc] = await Promise.all([
    loadImageDataUri('ms-header.png'),
    loadImageDataUri('ms-footer.png'),
  ])
  cachedAssets = { headerSrc, footerSrc }
  return cachedAssets
}

function defaultFileName(doc: DocumentRecord): string {
  const prefix =
    doc.doc_type === 'proforma'
      ? 'Proforma_Invoice'
      : doc.doc_type === 'invoice'
        ? 'Invoice'
        : doc.doc_type === 'order_form'
          ? 'Order_Form'
          : 'Delivery_Note'
  const safeClient = String(doc.client_name || 'Client')
    .trim()
    .replaceAll(/[^a-z0-9]+/gi, '_')
    .replaceAll(/^_+|_+$/g, '')
    .slice(0, 32)
  return `${prefix}_${doc.doc_number}_${safeClient || 'Document'}.pdf`
}

async function createDocWindow(parent: MainWindow, title: string, html: string) {
  const win = new BrowserWindow({
    parent,
    show: false,
    width: 900,
    height: 1120,
    title,
    webPreferences: { sandbox: true },
  })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  } catch {
    win.destroy()
    throw new Error('REPORT_RENDER_FAILED')
  }
  return win
}

export async function exportDocumentPdf(parent: MainWindow, doc: DocumentRecord) {
  const directory = documentsDirectory()
  try {
    await mkdir(directory, { recursive: true })
  } catch (error) {
    console.error('[documents] Could not create documents directory:', error)
    throw new Error('REPORT_STORAGE_FAILED')
  }

  const fileName = defaultFileName(doc)
  const choice = await dialog.showSaveDialog(parent, {
    title: `Save ${fileName}`,
    defaultPath: path.join(directory, fileName),
    filters: [{ name: 'PDF document', extensions: ['pdf'] }],
  })
  if (choice.canceled || !choice.filePath) return null

  const filePath = choice.filePath.toLowerCase().endsWith('.pdf') ? choice.filePath : `${choice.filePath}.pdf`
  const assets = await getBrandingAssets()
  const html = buildDocumentHtml(doc, assets)
  const win = await createDocWindow(parent, fileName, html)

  try {
    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      landscape: false,
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    })
    if (pdf.length < 5 || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('PDF_RENDER_FAILED')
    }
    await writeFile(filePath, pdf)
    const bytes = (await stat(filePath)).size
    if (bytes < 5) throw new Error('PDF_WRITE_FAILED')
    return { path: filePath, bytes }
  } catch (error) {
    if (error instanceof Error && ['PDF_WRITE_FAILED', 'PDF_RENDER_FAILED', 'REPORT_RENDER_FAILED'].includes(error.message)) {
      throw error
    }
    console.error('[documents] PDF generation failed:', error)
    throw new Error('PDF_EXPORT_FAILED')
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

export async function printDocument(parent: MainWindow, doc: DocumentRecord) {
  const assets = await getBrandingAssets()
  const html = buildDocumentHtml(doc, assets)
  const win = await createDocWindow(parent, `Print ${doc.doc_number}`, html)

  return new Promise<{ printed: boolean }>((resolve, reject) => {
    win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
      if (!win.isDestroyed()) win.destroy()
      if (!success && failureReason && failureReason !== 'cancelled') {
        reject(new Error('PDF_EXPORT_FAILED'))
        return
      }
      resolve({ printed: success })
    })
  })
}
