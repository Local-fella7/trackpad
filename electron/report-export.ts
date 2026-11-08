import ExcelJS from 'exceljs'
import { app, BrowserWindow, dialog, type BrowserWindow as MainWindow } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

type Report = { title?: string; period: string; rows: Record<string, unknown>[]; summary: Record<string, unknown>[] }
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

export async function exportExcel(window: MainWindow, report: Report) {
  const choice = await dialog.showSaveDialog(window, { defaultPath: `Trackpad_${report.period}.xlsx`, filters: [{ name: 'Excel', extensions: ['xlsx'] }] })
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
  records.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; records.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF147D58' } }
  await writeFile(choice.filePath, Buffer.from(await workbook.xlsx.writeBuffer()))
  return choice.filePath
}

export async function exportPdf(window: MainWindow, report: Report) {
  const reportsDirectory = path.join(app.getPath('documents'), 'Trackpad', 'Reports')
  await mkdir(reportsDirectory, { recursive: true })
  const suggestedName = `Trackpad_${report.period.replaceAll(/[^a-z0-9_-]/gi, '-')}`
  const choice = await dialog.showSaveDialog(window, { defaultPath: path.join(reportsDirectory, `${suggestedName}.pdf`), filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (choice.canceled || !choice.filePath) return null
  const allHeaders = Object.keys(report.rows[0] ?? report.summary[0] ?? {})
  const preferred = ['record_number', 'client_name', 'record_date', 'event_date', 'status_name', 'grand_total_minor', 'paid_minor', 'payment_status', 'invoice_no', 'location']
  const headers = preferred.filter(key => allHeaders.includes(key)).concat(
    allHeaders.filter(key => !preferred.includes(key) && !['id', 'status_id', 'currency', 'deleted_at', 'created_at', 'updated_at'].includes(key)).slice(0, 5),
  )
  const widths = headers.map(key => key.includes('name') || key.includes('title') ? 20 : key.includes('number') ? 13 : 100 / Math.max(headers.length, 1))
  const formatNumber = (value: unknown) => new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(Number(value || 0))
  const formatCell = (key: string, value: unknown) => key.includes('minor') || key.includes('total') || key.includes('amount') ? `${formatNumber(value)} TZS` : String(value ?? '—')
  const summaryHtml = report.summary.map(item => `<div><b>${escapeHtml(item.status_name ?? item.client_name ?? 'Total')}</b><br>${escapeHtml(item.records ?? 0)} orders · <b>${escapeHtml(formatNumber(item.total_minor ?? item.grand_total_minor))} TZS</b></div>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:12mm}body{font:9px Arial;color:#18253a}header{border-bottom:3px solid #147d58;padding-bottom:8px;margin-bottom:12px}h1{margin:0;font-size:20px}.summary{display:flex;gap:8px;margin:10px 0}.summary div{background:#edf8f2;padding:7px;border-radius:4px;min-width:110px}.summary b{font-size:10px}table{width:100%;table-layout:fixed;border-collapse:collapse}th{background:#147d58;color:white;text-align:left;padding:7px 5px;font-size:8px;text-transform:uppercase}td{border-bottom:1px solid #dfe6ed;padding:6px 5px;overflow-wrap:anywhere;vertical-align:top}tr{page-break-inside:avoid}thead{display:table-header-group}footer{position:fixed;bottom:0;color:#66758b;font-size:8px}</style></head><body><header><h1>${escapeHtml(report.title ?? 'Trackpad Report')}</h1><p>Period: ${escapeHtml(report.period)} · Generated ${escapeHtml(new Date().toLocaleString())}</p></header><section class="summary">${summaryHtml}</section><table><colgroup>${widths.map(width=>`<col style="width:${width}%">`).join('')}</colgroup><thead><tr>${headers.map(key => `<th>${escapeHtml(key.replaceAll('_', ' ').replaceAll(/\b\w/g, (c:string)=>c.toUpperCase()))}</th>`).join('')}</tr></thead><tbody>${report.rows.length ? report.rows.map(row => `<tr>${headers.map(key => `<td>${escapeHtml(formatCell(key, row[key]))}</td>`).join('')}</tr>`).join('') : '<tr><td colspan="100%">No records match this report.</td></tr>'}</tbody></table><footer>Trackpad · Confidential</footer></body></html>`
  const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await new Promise<void>(resolve => setTimeout(resolve, 150))
    const pdf = await printWindow.webContents.printToPDF({ pageSize: 'A4', landscape: true, printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } })
    await writeFile(choice.filePath, pdf)
  } finally { printWindow.destroy() }
  return choice.filePath
}
