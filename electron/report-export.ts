import ExcelJS from 'exceljs'
import { BrowserWindow, dialog, type BrowserWindow as MainWindow } from 'electron'
import { writeFile } from 'node:fs/promises'

type Report = { title?: string; period: string; rows: Record<string, unknown>[]; summary: Record<string, unknown>[] }
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

export async function exportExcel(window: MainWindow, report: Report) {
  const choice = await dialog.showSaveDialog(window, { defaultPath: `Business-Records_${report.period}.xlsx`, filters: [{ name: 'Excel', extensions: ['xlsx'] }] })
  if (choice.canceled || !choice.filePath) return null
  const workbook = new ExcelJS.Workbook()
  const summary = workbook.addWorksheet('Summary')
  summary.addRow([report.title ?? 'Business Records', report.period])
  summary.addRows(report.summary)
  const records = workbook.addWorksheet('Records', { views: [{ state: 'frozen', ySplit: 1 }] })
  const columns = Object.keys(report.rows[0] ?? {})
  records.columns = columns.map(key => ({ header: key.replaceAll('_', ' ').toUpperCase(), key, width: 18 }))
  report.rows.forEach(row => records.addRow(row))
  records.autoFilter = { from: 'A1', to: { row: 1, column: Math.max(1, columns.length) } }
  records.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; records.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF147D58' } }
  await writeFile(choice.filePath, Buffer.from(await workbook.xlsx.writeBuffer()))
  return choice.filePath
}

export async function exportPdf(window: MainWindow, report: Report) {
  const suggestedName = `Business-Records_${report.period}`
  const choice = await dialog.showSaveDialog(window, { defaultPath: `${suggestedName}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (choice.canceled || !choice.filePath) return null
  const headers = Object.keys(report.rows[0] ?? {})
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:16mm}body{font:11px Arial;color:#18253a}header{border-bottom:3px solid #147d58;padding-bottom:12px;margin-bottom:20px}h1{margin:0;font-size:24px}p{color:#66758b}.summary{display:flex;gap:10px;margin:16px 0}.summary div{background:#edf8f2;padding:10px;border-radius:5px;min-width:120px}table{width:100%;border-collapse:collapse}th{background:#147d58;color:white;text-align:left;padding:8px;font-size:9px}td{border-bottom:1px solid #dfe6ed;padding:7px;vertical-align:top}tr{page-break-inside:avoid}footer{position:fixed;bottom:0;color:#66758b;font-size:9px}</style></head><body><header><h1>${escapeHtml(report.title ?? 'Business Records report')}</h1><p>Period: ${escapeHtml(report.period)} · Generated ${escapeHtml(new Date().toLocaleString())}</p></header><section class="summary">${report.summary.map(item => `<div><b>${escapeHtml(item.records ?? 'Total')} records</b><br>${escapeHtml(item.total_minor ?? item.grand_total_minor ?? '')} ${escapeHtml(item.currency ?? 'TZS')}</div>`).join('')}</section><table><thead><tr>${headers.map(key => `<th>${escapeHtml(key.replaceAll('_', ' '))}</th>`).join('')}</tr></thead><tbody>${report.rows.map(row => `<tr>${headers.map(key => `<td>${escapeHtml(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table><footer>Business Records · Confidential</footer></body></html>`
  const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try { await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`); await writeFile(choice.filePath, await printWindow.webContents.printToPDF({ pageSize: 'A4', printBackground: true, displayHeaderFooter: true })) } finally { printWindow.destroy() }
  return choice.filePath
}
