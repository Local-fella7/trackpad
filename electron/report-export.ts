import ExcelJS from 'exceljs'
import { dialog, type BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'

export async function exportExcel(window: BrowserWindow, report: { period: string; rows: Record<string, unknown>[]; summary: Record<string, unknown>[] }) {
  const choice = await dialog.showSaveDialog(window, { defaultPath: `Business-Records_${report.period}.xlsx`, filters: [{ name: 'Excel', extensions: ['xlsx'] }] })
  if (choice.canceled || !choice.filePath) return null
  const workbook = new ExcelJS.Workbook()
  const summary = workbook.addWorksheet('Summary')
  summary.addRows(report.summary)
  const records = workbook.addWorksheet('Records', { views: [{ state: 'frozen', ySplit: 1 }] })
  const columns = Object.keys(report.rows[0] ?? {})
  records.columns = columns.map(key => ({ header: key, key, width: 18 }))
  report.rows.forEach(row => records.addRow(row))
  records.autoFilter = { from: 'A1', to: { row: 1, column: Math.max(1, columns.length) } }
  await writeFile(choice.filePath, Buffer.from(await workbook.xlsx.writeBuffer()))
  return choice.filePath
}

export async function exportPdf(window: BrowserWindow, suggestedName: string) {
  const choice = await dialog.showSaveDialog(window, { defaultPath: `${suggestedName}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (choice.canceled || !choice.filePath) return null
  await writeFile(choice.filePath, await window.webContents.printToPDF({ pageSize: 'A4', printBackground: true }))
  return choice.filePath
}
