import { app, BrowserWindow, ipcMain } from 'electron'
import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRecoveryKey, hashSecret, verifySecret } from './auth'
import { getSessionUser, lockIfIdle, login, logout, touchSession } from './session'
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from './login-attempts'
import { toIpcResult } from './errors'
import { loginSchema, recoverSchema, setupSchema } from './schemas'
import { openDatabase } from './db'
import type Database from 'better-sqlite3'
import { getRecord, listRecords, saveRecord, softDeleteRecord } from './db/repos/records'
import { requireSessionUser } from './session'
import { createStatus, listStatuses, removeStatus, reorderStatuses, setDefaultStatus, updateStatus } from './db/repos/statuses'
import { getSettings, setSetting } from './db/repos/settings'
import { getDashboardData } from './dashboard'
import { getReportData, type ReportType } from './reports'
import { exportExcel, exportPdf } from './report-export'

const isDevelopment = !app.isPackaged
let mainWindow: BrowserWindow | null = null
let database: Database.Database | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.setMenuBarVisibility(false)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (isDevelopment) {
    void mainWindow.loadURL('http://localhost:3000')
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), '.output', 'public', 'index.html'))
  }
}

app.whenReady().then(() => {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  database = openDatabase(app.getPath('userData'))
  createWindow()

  ipcMain.handle('proof:run', async () => {
    if (!database || !mainWindow) throw new Error('Application is not ready')

    database.prepare('INSERT INTO proof_runs DEFAULT VALUES').run()
    const row = database.prepare('SELECT COUNT(*) AS count FROM proof_runs').get() as { count: number }
    const reportsDirectory = path.join(app.getPath('documents'), 'Business Records', 'Reports')
    mkdirSync(reportsDirectory, { recursive: true })
    const pdfPath = path.join(reportsDirectory, 'technical-proof.pdf')
    const pdf = await mainWindow.webContents.printToPDF({ pageSize: 'A4', printBackground: true })
    await writeFile(pdfPath, pdf)

    return { recordCount: row.count, pdfPath }
  })

  ipcMain.handle('auth:status', () => toIpcResult(() => ({ hasUser: Boolean(database?.prepare('SELECT 1 FROM users LIMIT 1').get()), user: getSessionUser() })))
  ipcMain.handle('auth:setup', (_event, input: unknown) => toIpcResult(() => {
    if (!database || typeof input !== 'object' || input === null) throw new Error('INVALID_INPUT')
    if (database.prepare('SELECT 1 FROM users LIMIT 1').get()) throw new Error('SETUP_ALREADY_COMPLETE')
    const { username, displayName, password } = setupSchema.parse(input)
    const recoveryKey = createRecoveryKey()
    const result = database.prepare('INSERT INTO users (username, display_name, password_hash, recovery_hash) VALUES (?, ?, ?, ?)').run(username.trim(), displayName.trim(), hashSecret(password), hashSecret(recoveryKey))
    login({ id: Number(result.lastInsertRowid), username: username.trim(), displayName: displayName.trim() })
    return { recoveryKey }
  }))
  ipcMain.handle('auth:login', (_event, input: unknown) => toIpcResult(() => {
    if (!database || typeof input !== 'object' || input === null) throw new Error('INVALID_INPUT')
    const { username, password } = loginSchema.parse(input)
    assertLoginAllowed(username)
    const user = database.prepare('SELECT id, username, display_name, password_hash FROM users WHERE username = ? COLLATE NOCASE').get(username.trim()) as { id: number; username: string; display_name: string; password_hash: string } | undefined
    if (!user || !verifySecret(password, user.password_hash)) { recordLoginFailure(username); throw new Error('INVALID_CREDENTIALS') }
    const sessionUser = { id: user.id, username: user.username, displayName: user.display_name }
    login(sessionUser)
    clearLoginFailures(username)
    return sessionUser
  }))
  ipcMain.handle('auth:recover', (_event, input: unknown) => toIpcResult(() => {
    if (!database) throw new Error('INVALID_INPUT')
    const { username, recoveryKey, newPassword } = recoverSchema.parse(input)
    const user = database.prepare('SELECT id, recovery_hash FROM users WHERE username = ? COLLATE NOCASE').get(username) as { id: number; recovery_hash: string } | undefined
    if (!user || !verifySecret(recoveryKey, user.recovery_hash)) throw new Error('INVALID_CREDENTIALS')
    const newRecoveryKey = createRecoveryKey()
    database.prepare('UPDATE users SET password_hash = ?, recovery_hash = ? WHERE id = ?').run(hashSecret(newPassword), hashSecret(newRecoveryKey), user.id)
    return { recoveryKey: newRecoveryKey }
  }))
  ipcMain.handle('auth:logout', () => toIpcResult(() => { logout(); return null }))
  ipcMain.handle('auth:touch', () => toIpcResult(() => { touchSession(); return getSessionUser() }))
  ipcMain.handle('auth:lockIfIdle', (_event, minutes: unknown) => toIpcResult(() => lockIfIdle(typeof minutes === 'number' ? minutes : 0)))
  ipcMain.handle('records:list', (_event, input: unknown) => toIpcResult(() => {
    requireSessionUser(); return listRecords(database!, typeof input === 'object' && input && 'search' in input && typeof input.search === 'string' ? input.search : '')
  }))
  ipcMain.handle('records:get', (_event, id: unknown) => toIpcResult(() => { requireSessionUser(); return getRecord(database!, Number(id)) }))
  ipcMain.handle('records:create', (_event, input: unknown) => toIpcResult(() => {
    const user = requireSessionUser(); const payload = input as { record: import('./db/repos/records').RecordInput; items: import('../shared/types').ItemInput[] }
    return saveRecord(database!, null, payload.record, payload.items, user.id)
  }))
  ipcMain.handle('records:update', (_event, input: unknown) => toIpcResult(() => {
    const user = requireSessionUser(); const payload = input as { id: number; record: import('./db/repos/records').RecordInput; items: import('../shared/types').ItemInput[] }
    return saveRecord(database!, payload.id, payload.record, payload.items, user.id)
  }))
  ipcMain.handle('records:delete', (_event, id: unknown) => toIpcResult(() => softDeleteRecord(database!, Number(id), requireSessionUser().id)))
  ipcMain.handle('statuses:list', () => toIpcResult(() => { requireSessionUser(); return listStatuses(database!) }))
  ipcMain.handle('statuses:create', (_event, input: unknown) => toIpcResult(() => {
    requireSessionUser()
    if (!input || typeof input !== 'object') throw new Error('INVALID_INPUT')
    const value = input as Record<string, unknown>
    if (typeof value.name !== 'string' || typeof value.color !== 'string') throw new Error('INVALID_INPUT')
    return createStatus(database!, { name: value.name.trim(), color: value.color, isActive: value.isActive !== false, excludeFromTotals: value.excludeFromTotals === true })
  }))
  ipcMain.handle('statuses:update', (_event, input: unknown) => toIpcResult(() => {
    requireSessionUser(); const value = input as Record<string, unknown>
    if (!value || typeof value.id !== 'number' || typeof value.name !== 'string' || typeof value.color !== 'string') throw new Error('INVALID_INPUT')
    return updateStatus(database!, value.id, { name: value.name.trim(), color: value.color, isActive: value.isActive !== false, excludeFromTotals: value.excludeFromTotals === true })
  }))
  ipcMain.handle('statuses:reorder', (_event, ids: unknown) => toIpcResult(() => { requireSessionUser(); if (!Array.isArray(ids) || !ids.every(Number.isInteger)) throw new Error('INVALID_INPUT'); return reorderStatuses(database!, ids) }))
  ipcMain.handle('statuses:setDefault', (_event, id: unknown) => toIpcResult(() => { requireSessionUser(); return setDefaultStatus(database!, Number(id)) }))
  ipcMain.handle('statuses:remove', (_event, id: unknown) => toIpcResult(() => { requireSessionUser(); return removeStatus(database!, Number(id)) }))
  ipcMain.handle('settings:get', () => toIpcResult(() => { requireSessionUser(); return getSettings(database!) }))
  ipcMain.handle('settings:set', (_event, input: unknown) => toIpcResult(() => {
    requireSessionUser()
    if (!input || typeof input !== 'object') throw new Error('INVALID_INPUT')
    const value = input as Record<string, unknown>
    if (typeof value.key !== 'string' || typeof value.value !== 'string') throw new Error('INVALID_INPUT')
    setSetting(database!, value.key, value.value)
    return { key: value.key, value: value.value }
  }))
  ipcMain.handle('dashboard:data', () => toIpcResult(() => {
    requireSessionUser()
    return getDashboardData(database!, new Date().toISOString().slice(0, 10))
  }))
  ipcMain.handle('reports:data', (_event, input: unknown) => toIpcResult(() => {
    requireSessionUser()
    if (!input || typeof input !== 'object') throw new Error('INVALID_INPUT')
    const value = input as { type?: string; params?: { day?: string; month?: string; days?: number } }
    if (value.type !== 'daily' && value.type !== 'monthly' && value.type !== 'upcoming-events') throw new Error('INVALID_INPUT')
    return getReportData(database!, value.type as ReportType, value.params ?? {})
  }))
  ipcMain.handle('reports:exportExcel', (_event, report: unknown) => toIpcResult(() => { requireSessionUser(); if (!mainWindow || !report || typeof report !== 'object') throw new Error('INVALID_INPUT'); return exportExcel(mainWindow, report as { period: string; rows: Record<string, unknown>[]; summary: Record<string, unknown>[] }) }))
  ipcMain.handle('reports:exportPdf', (_event, name: unknown) => toIpcResult(() => { requireSessionUser(); if (!mainWindow || typeof name !== 'string') throw new Error('INVALID_INPUT'); return exportPdf(mainWindow, name) }))
})

app.on('second-instance', () => mainWindow?.focus())
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => database?.close())
