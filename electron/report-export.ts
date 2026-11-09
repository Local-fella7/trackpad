import ExcelJS from 'exceljs'
import { app, BrowserWindow, dialog, shell, type BrowserWindow as MainWindow } from 'electron'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type Report = { title?: string; period: string; rows: Record<string, unknown>[]; summary: Record<string, unknown>[] }
const reportsDirectory = () => path.join(app.getPath('documents'), 'Trackpad', 'Reports')
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

export async function exportExcel(window: MainWindow, report: Report) {
  await mkdir(reportsDirectory(), { recursive: true })
  const choice = await dialog.showSaveDialog(window, { defaultPath: path.join(reportsDirectory(), `Trackpad_${report.period.replaceAll(/[^a-z0-9_-]/gi, '-')}.xlsx`), filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }] })
  if (choice.canceled || !choice.filePath) return null
  const workbook = new ExcelJS.Workbook()
  const summary = workbook.addWorksheet('Summary')
  summary.addRow([report.title ?? 'Trackpad Report', report.period])
  if (report.summary.length) {
    const keys = Object.keys(report.summary[0])
    summary.addRow(keys.map(key => key.replaceAll('_', ' ').toUpperCase()))
    report.summary.forEach(row => summary.addRow(keys.map(key => row[key])))
    summary.getRow(2).font = { bold: true }
  }
  const records = workbook.addWorksheet('Orders', { views: [{ state: 'frozen', ySplit: 1 }] })
  const columns = Object.keys(report.rows[0] ?? {})
  records.columns = columns.map(key => ({ header: key.replaceAll('_', ' ').toUpperCase(), key, width: 18 }))
  report.rows.forEach(row => records.addRow(row))
  records.autoFilter = { from: 'A1', to: { row: 1, column: Math.max(1, columns.length) } }
  records.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  records.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF147D58' } }
  await writeFile(choice.filePath, Buffer.from(await workbook.xlsx.writeBuffer()))
  return choice.filePath
}

function timestamp() { return new Date().toISOString().replaceAll(/[:.]/g, '-').replace('T', '_').slice(0, 19) }

function buildReportHtml(report: Report) {
  const allHeaders = Object.keys(report.rows[0] ?? report.summary[0] ?? {})
  const preferred = ['record_number', 'client_name', 'record_date', 'event_date', 'status_name', 'grand_total_minor', 'paid_minor', 'payment_status', 'invoice_no', 'location']
  const headers = preferred.filter(key => allHeaders.includes(key)).concat(allHeaders.filter(key => !preferred.includes(key) && !['id', 'status_id', 'currency', 'deleted_at', 'created_at', 'updated_at'].includes(key)).slice(0, 5))
  const formatNumber = (value: unknown) => new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(value || 0))
  const formatCell = (key: string, value: unknown) => key.includes('minor') || key.includes('total') || key.includes('amount') ? `${formatNumber(value)} TZS` : String(value ?? '-')
  const summary = report.summary.map(item => `<article><b>${escapeHtml(item.status_name ?? item.client_name ?? 'Total')}</b><span>${escapeHtml(item.records ?? 0)} orders</span><strong>${escapeHtml(formatNumber(item.total_minor ?? item.grand_total_minor))} TZS</strong></article>`).join('')
  const headings = headers.map(key => `<th>${escapeHtml(key.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase()))}</th>`).join('')
  const rows = report.rows.length ? report.rows.map(row => `<tr>${headers.map(key => `<td>${escapeHtml(formatCell(key, row[key]))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${Math.max(headers.length, 1)}" class="empty">No records match this report.</td></tr>`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title ?? 'Trackpad Report')}</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#172b23}header{display:flex;justify-content:space-between;align-items:start;border-bottom:3px solid #147d58;padding-bottom:12px;margin-bottom:14px}h1{font-size:22px;margin:0 0 5px}p{margin:0;color:#607069}.summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.summary article{min-width:130px;border:1px solid #dce8e2;background:#f2faf6;border-radius:5px;padding:8px}.summary b,.summary span,.summary strong{display:block}.summary span{font-size:8px;color:#607069;margin:3px 0}.summary strong{font-size:11px}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#147d58;color:#fff;text-align:left;padding:7px 5px;font-size:8px;text-transform:uppercase}td{border-bottom:1px solid #dfe6e2;padding:7px 5px;overflow-wrap:anywhere;vertical-align:top}tr{page-break-inside:avoid}thead{display:table-header-group}.empty{text-align:center;padding:28px}footer{margin-top:10px;color:#607069;font-size:8px}</style></head><body><header><div><h1>${escapeHtml(report.title ?? 'Trackpad Report')}</h1><p>Period: ${escapeHtml(report.period)}</p></div><p>Generated ${escapeHtml(new Date().toLocaleString())}</p></header>${summary ? `<section class="summary">${summary}</section>` : ''}<table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table><footer>Trackpad Report - Confidential</footer></body></html>`
}

async function createReportWindow(parent: MainWindow, report: Report, visible = false) {
  const reportWindow = new BrowserWindow({ parent, show: false, width: 1050, height: 760, title: report.title ?? 'Trackpad Report', webPreferences: { sandbox: true } })
  await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildReportHtml(report))}`)
  await new Promise<void>(resolve => setTimeout(resolve, 200))
  if (visible) { reportWindow.show(); reportWindow.focus() }
  return reportWindow
}

export async function exportPdf(window: MainWindow, report: Report) {
  const directory = reportsDirectory()
  await mkdir(directory, { recursive: true })
  const filePath = path.join(directory, `Trackpad_${report.period.replaceAll(/[^a-z0-9_-]/gi, '-')}_${timestamp()}.pdf`)
  const reportWindow = await createReportWindow(window, report)
  try {
    const pdf = await reportWindow.webContents.printToPDF({ pageSize: 'A4', landscape: true, printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } })
    await writeFile(filePath, pdf)
    const bytes = (await stat(filePath)).size
    if (bytes === 0) throw new Error('PDF_WRITE_FAILED')
    return { path: filePath, bytes }
  } catch (error) {
    if (error instanceof Error && error.message === 'PDF_WRITE_FAILED') throw error
    throw new Error('PDF_EXPORT_FAILED')
  } finally { reportWindow.destroy() }
}

export async function printReport(parent: MainWindow, report: Report) {
  const reportWindow = await createReportWindow(parent, report, true)
  try {
    await new Promise<void>((resolve, reject) => reportWindow.webContents.print({ silent: false, printBackground: true, landscape: true, pageSize: 'A4' }, (success, reason) => success ? resolve() : reject(new Error(reason || 'PRINT_FAILED'))))
  } finally { if (!reportWindow.isDestroyed()) reportWindow.destroy() }
}

export async function revealReport(filePath: string) {
  const root = path.resolve(reportsDirectory())
  const candidate = path.resolve(filePath)
  if (!candidate.startsWith(`${root}${path.sep}`)) throw new Error('REPORT_FILE_NOT_FOUND')
  try { if (!(await stat(candidate)).isFile()) throw new Error('REPORT_FILE_NOT_FOUND') } catch { throw new Error('REPORT_FILE_NOT_FOUND') }
  shell.showItemInFolder(candidate)
}
