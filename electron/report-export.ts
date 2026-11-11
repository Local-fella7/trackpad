import ExcelJS from 'exceljs'
import { app, BrowserWindow, dialog, shell, type BrowserWindow as MainWindow } from 'electron'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { formatDate, formatDateTime, formatReportPeriod } from '../shared/date'
import type { ReportColumn } from './reports'

export type Report = {
  type?: string
  title?: string
  period: string
  columns?: ReportColumn[]
  rows: Record<string, unknown>[]
  summary: Record<string, unknown>[]
}

const reportsDirectory = () => path.join(app.getPath('documents'), 'Trackpad', 'Reports')
const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )

const formatNumber = (value: unknown) =>
  new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(value || 0))

function resolveColumns(report: Report): ReportColumn[] {
  if (Array.isArray(report.columns) && report.columns.length) return report.columns
  const allHeaders = Object.keys(report.rows[0] ?? report.summary[0] ?? {})
  const preferred = [
    'record_number',
    'client_name',
    'record_date',
    'event_date',
    'status_name',
    'grand_total_minor',
    'paid_minor',
    'balance_minor',
    'payment_status',
    'invoice_no',
    'location',
  ]
  const keys = preferred
    .filter(key => allHeaders.includes(key))
    .concat(
      allHeaders
        .filter(
          key =>
            !preferred.includes(key) &&
            !['id', 'status_id', 'currency', 'deleted_at', 'created_at', 'updated_at'].includes(key),
        )
        .slice(0, 5),
    )
  return keys.map(key => ({
    key,
    label: key.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase()),
    kind:
      key.includes('minor') || key.includes('total') || key.includes('amount')
        ? 'money'
        : key.includes('date')
          ? 'date'
          : key === 'records'
            ? 'number'
            : 'text',
    total: key.includes('minor') || key.includes('total') || key === 'records',
  }))
}

function formatCellValue(col: ReportColumn, value: unknown): string {
  if (col.kind === 'money' || col.key.includes('minor')) {
    return `${formatNumber(value)} TZS`
  }
  if (col.kind === 'date' || col.key.includes('date')) {
    return formatDate(value, '-')
  }
  if (col.kind === 'number') {
    return formatNumber(value)
  }
  const text = String(value ?? '').trim()
  return text || '-'
}

function sumColumn(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0)
}

export async function exportExcel(window: MainWindow, report: Report) {
  await mkdir(reportsDirectory(), { recursive: true })
  const safePeriod = formatReportPeriod(report.period).replaceAll(/[^a-z0-9_-]/gi, '-')
  const choice = await dialog.showSaveDialog(window, {
    defaultPath: path.join(reportsDirectory(), `Trackpad_${safePeriod}.xlsx`),
    filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }],
  })
  if (choice.canceled || !choice.filePath) return null

  const columns = resolveColumns(report)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 4 }] })

  sheet.addRow([report.title ?? 'Trackpad Report'])
  sheet.addRow([
    `Period: ${formatReportPeriod(report.period)}`,
    `Generated: ${formatDateTime(new Date())}`,
    `Records: ${report.rows.length}`,
  ])
  sheet.addRow([])

  sheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF43766C' } }
  sheet.getRow(2).font = { italic: true, size: 10, color: { argb: 'FF73685D' } }

  const headerRow = sheet.addRow(columns.map(col => col.label.toUpperCase()))
  headerRow.font = { bold: true, color: { argb: 'FFF8FAE5' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF43766C' } }

  columns.forEach((col, index) => {
    sheet.getColumn(index + 1).width = col.kind === 'money' ? 18 : col.key === 'items_summary' ? 28 : 18
  })

  report.rows.forEach(row => {
    sheet.addRow(
      columns.map(col => {
        if (col.kind === 'money' || col.kind === 'number') return Number(row[col.key] || 0)
        return formatCellValue(col, row[col.key])
      }),
    )
  })

  if (report.rows.length) {
    const footerValues = columns.map((col, idx) => {
      if (idx === 0) return `TOTAL (${report.rows.length} records)`
      if (col.total) {
        const total = sumColumn(report.rows, col.key)
        return col.kind === 'money' ? `${formatNumber(total)} TZS` : total
      }
      return ''
    })
    const totalRow = sheet.addRow(footerValues)
    totalRow.font = { bold: true, color: { argb: 'FF26211D' } }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAE5' } }
  }

  await writeFile(choice.filePath, Buffer.from(await workbook.xlsx.writeBuffer()))
  return choice.filePath
}

function timestamp() {
  return new Date().toISOString().replaceAll(/[:.]/g, '-').replace('T', '_').slice(0, 19)
}

function buildReportHtml(report: Report) {
  const columns = resolveColumns(report)
  const headings = columns
    .map(
      col =>
        `<th class="${col.kind === 'money' || col.kind === 'number' ? 'num' : ''}">${escapeHtml(col.label)}</th>`,
    )
    .join('')

  const rows = report.rows.length
    ? report.rows
        .map(
          row =>
            `<tr>${columns
              .map(
                col =>
                  `<td class="${col.kind === 'money' || col.kind === 'number' ? 'num' : ''}">${escapeHtml(formatCellValue(col, row[col.key]))}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('')
    : `<tr><td colspan="${Math.max(columns.length, 1)}" class="empty">No records match this report.</td></tr>`

  const footerRow = report.rows.length
    ? `<tfoot><tr>${columns
        .map((col, idx) => {
          if (idx === 0) return `<td>TOTAL (${report.rows.length} records)</td>`
          if (col.total) {
            const sum = sumColumn(report.rows, col.key)
            const formatted = col.kind === 'money' ? `${formatNumber(sum)} TZS` : formatNumber(sum)
            return `<td class="num">${escapeHtml(formatted)}</td>`
          }
          return `<td></td>`
        })
        .join('')}</tr></tfoot>`
    : ''

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title ?? 'Trackpad Report')}</title><style>
    @page{size:A4 landscape;margin:12mm}
    *{box-sizing:border-box}
    body{font:10px Inter,Arial,sans-serif;color:#26211D;margin:0}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #43766C;padding-bottom:10px;margin-bottom:14px}
    .brand-tag{font-size:8px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#B19470;margin-bottom:3px}
    h1{font-size:19px;margin:0 0 4px;color:#26211D}
    p{margin:0;color:#73685D;font-size:9.5px}
    .meta{text-align:right}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th{background:#43766C;color:#F8FAE5;text-align:left;padding:7px 6px;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;border:1px solid #355f57}
    td{border:1px solid #E5DEC9;padding:6px 6px;overflow-wrap:anywhere;vertical-align:top;font-size:9px}
    tbody tr:nth-child(even) td{background:#FBFCF4}
    tfoot td{background:#F8FAE5;border-top:2px solid #43766C;border-bottom:2px solid #43766C;font-weight:800;font-size:9.5px;color:#26211D;padding:8px 6px}
    .num{text-align:right;white-space:nowrap}
    tr{page-break-inside:avoid}
    thead{display:table-header-group}
    tfoot{display:table-footer-group}
    .empty{text-align:center;padding:28px;color:#73685D}
    footer{margin-top:12px;display:flex;justify-content:space-between;color:#73685D;font-size:8px;border-top:1px solid #E5DEC9;padding-top:6px}
  </style></head><body>
    <header>
      <div>
        <div class="brand-tag">TRACKPAD ORDER MANAGEMENT · FORMAL STATEMENT</div>
        <h1>${escapeHtml(report.title ?? 'Trackpad Report')}</h1>
        <p>Reporting Period: <strong>${escapeHtml(formatReportPeriod(report.period))}</strong> · Total Records: <strong>${report.rows.length}</strong></p>
      </div>
      <div class="meta">
        <p>Generated on: <strong>${escapeHtml(formatDateTime(new Date()))}</strong></p>
        <p>Currency: <strong>TZS</strong></p>
      </div>
    </header>
    <table>
      <thead><tr>${headings}</tr></thead>
      <tbody>${rows}</tbody>
      ${footerRow}
    </table>
    <footer>
      <span>Trackpad Formal Report</span>
      <span>Amounts in Tanzanian Shillings (TZS)</span>
    </footer>
  </body></html>`
}

function buildOrderItemsHtml(detail: { record: Record<string, unknown>; items: Record<string, unknown>[] }) {
  const r = detail.record
  const items = detail.items || []
  const itemRows = items.length
    ? items
        .map((item, idx) => {
          const qty = Number(item.quantity_x100 || 0) / 100
          const unit = Number(item.unit_price_minor || 0)
          const lineTotal = Number(item.line_total_minor ?? qty * unit)
          return `<tr>
            <td class="num">${idx + 1}</td>
            <td>${escapeHtml(item.description)}</td>
            <td class="num">${escapeHtml(formatNumber(qty))}</td>
            <td class="num">${escapeHtml(formatNumber(unit))} TZS</td>
            <td class="num"><strong>${escapeHtml(formatNumber(lineTotal))} TZS</strong></td>
          </tr>`
        })
        .join('')
    : `<tr><td colspan="5" class="empty">No items recorded for this order.</td></tr>`

  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity_x100 || 0) / 100, 0)

  return `<!doctype html><html><head><meta charset="utf-8"><title>Order ${escapeHtml(r.record_number || '')} - Item List</title><style>
    @page{size:A4 portrait;margin:14mm}
    *{box-sizing:border-box}
    body{font:11px Inter,Arial,sans-serif;color:#26211D;margin:0}
    header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #43766C;padding-bottom:12px;margin-bottom:16px}
    .tag{font-size:9px;font-weight:800;letter-spacing:.14em;color:#B19470;text-transform:uppercase;margin-bottom:4px}
    h1{font-size:22px;margin:0 0 4px;color:#26211D}
    p{margin:2px 0;color:#73685D;font-size:10px}
    .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
    .info-box{border:1px solid #E5DEC9;background:#FBFCF4;border-radius:6px;padding:9px 11px}
    .info-box small{display:block;font-size:8.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#73685D;margin-bottom:3px}
    .info-box strong{font-size:11.5px;color:#26211D}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th{background:#43766C;color:#F8FAE5;text-align:left;padding:8px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;border:1px solid #355f57}
    td{border:1px solid #E5DEC9;padding:8px;font-size:10.5px}
    tbody tr:nth-child(even) td{background:#FBFCF4}
    tfoot td{background:#F8FAE5;font-weight:800;padding:8px;border:1px solid #E5DEC9}
    tfoot tr.grand td{border-top:2px solid #43766C;border-bottom:2px solid #43766C;font-size:11.5px;color:#43766C}
    .num{text-align:right;white-space:nowrap}
    .notes{border:1px solid #E5DEC9;background:#FBFCF4;border-radius:6px;padding:10px 12px;margin-top:12px}
    .notes small{display:block;font-size:8.5px;font-weight:800;text-transform:uppercase;color:#73685D;margin-bottom:4px}
    footer{margin-top:24px;border-top:1px solid #E5DEC9;padding-top:8px;display:flex;justify-content:space-between;color:#73685D;font-size:9px}
  </style></head><body>
    <header>
      <div>
        <div class="tag">TRACKPAD · ORDER ITEMS & SPECIFICATION SHEET</div>
        <h1>Order ${escapeHtml(r.record_number || `#${r.id}`)}</h1>
        <p>Client: <strong>${escapeHtml(r.client_name)}</strong></p>
      </div>
      <div style="text-align:right">
        <p>Order Date: <strong>${escapeHtml(formatDate(r.record_date, '-'))}</strong></p>
        <p>Event Date: <strong>${escapeHtml(formatDate(r.event_date, '-'))}</strong></p>
        <p>Printed: <strong>${escapeHtml(formatDateTime(new Date()))}</strong></p>
      </div>
    </header>
    <section class="info-grid">
      <div class="info-box"><small>Client & Contacts</small><strong>${escapeHtml(r.client_name)}</strong><p>${escapeHtml(r.contacts || 'No contact provided')}</p></div>
      <div class="info-box"><small>Event / Delivery Location</small><strong>${escapeHtml(r.location || 'Not specified')}</strong><p>Event Date: ${escapeHtml(formatDate(r.event_date, '-'))}</p></div>
      <div class="info-box"><small>Reference Documents</small><strong>Invoice: ${escapeHtml(r.invoice_no || '-')}</strong><p>Proforma: ${escapeHtml(r.proforma_no || '-')} · Delivery: ${escapeHtml(r.delivery_form_no || '-')}</p></div>
    </section>
    <table>
      <thead>
        <tr>
          <th style="width:42px" class="num">#</th>
          <th>Item / Service Description</th>
          <th style="width:90px" class="num">Quantity</th>
          <th style="width:130px" class="num">Unit Price</th>
          <th style="width:140px" class="num">Line Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2">Subtotal (${items.length} line item${items.length === 1 ? '' : 's'})</td>
          <td class="num">${escapeHtml(formatNumber(totalQty))}</td>
          <td></td>
          <td class="num">${escapeHtml(formatNumber(r.subtotal_minor))} TZS</td>
        </tr>
        <tr>
          <td colspan="4">Discount</td>
          <td class="num">- ${escapeHtml(formatNumber(r.discount_minor || 0))} TZS</td>
        </tr>
        <tr class="grand">
          <td colspan="4">GRAND TOTAL</td>
          <td class="num">${escapeHtml(formatNumber(r.grand_total_minor))} TZS</td>
        </tr>
      </tfoot>
    </table>
    ${r.notes ? `<div class="notes"><small>Remarks & Special Instructions</small><div>${escapeHtml(r.notes)}</div></div>` : ''}
    <footer>
      <span>Trackpad Order Specification Sheet</span>
      <span>Order ${escapeHtml(r.record_number || `#${r.id}`)} · ${escapeHtml(formatDate(r.record_date, '-'))}</span>
    </footer>
  </body></html>`
}

async function createHtmlWindow(parent: MainWindow, title: string, html: string, visible = false) {
  const win = new BrowserWindow({
    parent,
    show: false,
    width: 1050,
    height: 760,
    title,
    webPreferences: { sandbox: true },
  })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  } catch {
    win.destroy()
    throw new Error('REPORT_RENDER_FAILED')
  }
  if (visible) {
    win.show()
    win.focus()
  }
  return win
}

async function saveHtmlAsPdf(
  window: MainWindow,
  options: { title: string; defaultFileName: string; html: string; landscape: boolean },
) {
  const directory = reportsDirectory()
  try {
    await mkdir(directory, { recursive: true })
  } catch (error) {
    console.error('[reports] Could not create the reports directory:', error)
    throw new Error('REPORT_STORAGE_FAILED')
  }

  const choice = await dialog.showSaveDialog(window, {
    title: options.title,
    defaultPath: path.join(directory, options.defaultFileName),
    filters: [{ name: 'PDF document', extensions: ['pdf'] }],
  })
  if (choice.canceled || !choice.filePath) return null

  const filePath = choice.filePath.toLowerCase().endsWith('.pdf') ? choice.filePath : `${choice.filePath}.pdf`
  const reportWindow = await createHtmlWindow(window, options.title, options.html, false)
  try {
    const pdf = await reportWindow.webContents.printToPDF({
      pageSize: 'A4',
      landscape: options.landscape,
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    })
    if (pdf.length < 5 || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('PDF_RENDER_FAILED')
    try {
      await writeFile(filePath, pdf)
    } catch (error) {
      console.error('[reports] Could not write the PDF file:', error)
      throw new Error('PDF_WRITE_FAILED')
    }
    const bytes = (await stat(filePath)).size
    if (bytes < 5) throw new Error('PDF_WRITE_FAILED')
    return { path: filePath, bytes }
  } catch (error) {
    if (error instanceof Error && ['PDF_WRITE_FAILED', 'PDF_RENDER_FAILED', 'REPORT_RENDER_FAILED'].includes(error.message))
      throw error
    console.error('[reports] PDF generation failed:', error)
    throw new Error('PDF_EXPORT_FAILED')
  } finally {
    if (!reportWindow.isDestroyed()) reportWindow.destroy()
  }
}

export async function exportPdf(window: MainWindow, report: Report) {
  const safePeriod = formatReportPeriod(report.period).replaceAll(/[^a-z0-9_-]/gi, '-')
  return saveHtmlAsPdf(window, {
    title: report.title ?? 'Trackpad Report',
    defaultFileName: `Trackpad_${safePeriod}_${timestamp()}.pdf`,
    html: buildReportHtml(report),
    landscape: true,
  })
}

export async function printReport(parent: MainWindow, report: Report) {
  return exportPdf(parent, report)
}

export async function printOrderItems(
  parent: MainWindow,
  detail: { record: Record<string, unknown>; items: Record<string, unknown>[] },
) {
  const rawOrderNo = String(detail.record.record_number || `ORD-${detail.record.id || '0001'}`)
  const safeOrderNo = rawOrderNo.replaceAll(/[^a-z0-9_-]/gi, '-')
  return saveHtmlAsPdf(parent, {
    title: `Order ${rawOrderNo} - Item List`,
    defaultFileName: `Order_${safeOrderNo}_Items.pdf`,
    html: buildOrderItemsHtml(detail),
    landscape: false,
  })
}

export async function revealReport(filePath: string) {
  const candidate = path.resolve(filePath)
  const ext = path.extname(candidate).toLowerCase()
  if (ext !== '.pdf' && ext !== '.xlsx') throw new Error('REPORT_FILE_NOT_FOUND')
  try {
    if (!(await stat(candidate)).isFile()) throw new Error('REPORT_FILE_NOT_FOUND')
  } catch {
    throw new Error('REPORT_FILE_NOT_FOUND')
  }
  shell.showItemInFolder(candidate)
}
