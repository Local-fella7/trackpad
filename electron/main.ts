import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'
import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRecoveryKey, hashSecret, verifySecret } from './auth'
import { getSessionUser, lockIfIdle, login, logout, touchSession } from './session'
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from './login-attempts'
import { toIpcResult } from './errors'
import { loginSchema, recoverSchema, setupSchema } from './schemas'
import { openDatabase } from './db'
import type Database from 'better-sqlite3'
import { clearRecords, getRecord, legacyRecordCount, listRecords, nextRecordNumber, saveRecord, softDeleteRecord, updateWorkflow } from './db/repos/records'
import { requireSessionUser } from './session'
import { createStatus, listStatuses, removeStatus, reorderStatuses, setDefaultStatus, updateStatus } from './db/repos/statuses'
import { getSettings, setSetting } from './db/repos/settings'
import { getDashboardData } from './dashboard'
import { getReportData, reportTypes, type ReportType, type ReportParams } from './reports'
import { exportExcel, exportPdf } from './report-export'
import { applyRetention, backupHealth, copyBackupToDirectory, createBackup, listBackups, validateBackup } from './backup'
import { copyFileSync, existsSync } from 'node:fs'
import { addPayment, deletePayment, listBilling, listPayments } from './db/repos/payments'

const isDevelopment = !app.isPackaged
let mainWindow: BrowserWindow | null = null
let database: Database.Database | null = null

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}])

function registerStaticFileProtocol() {
  const staticRoot = path.resolve(app.getAppPath(), '.output', 'public')

  protocol.handle('app', (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname)
    const filePath = path.resolve(staticRoot, `.${pathname}`)
    if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${path.sep}`)) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    title: 'Trackpad',
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
    void mainWindow.loadURL('app://trackpad/index.html')
  }
}

app.whenReady().then(() => {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  database = openDatabase(app.getPath('userData'))
  registerStaticFileProtocol()
  createWindow()

  ipcMain.handle('proof:run', async () => {
    if (!database || !mainWindow) throw new Error('Application is not ready')

    database.prepare('INSERT INTO proof_runs DEFAULT VALUES').run()
    const row = database.prepare('SELECT COUNT(*) AS count FROM proof_runs').get() as { count: number }
    const reportsDirectory = path.join(app.getPath('documents'), 'Trackpad', 'Reports')
    mkdirSync(reportsDirectory, { recursive: true })
    const pdfPath = path.join(reportsDirectory, 'technical-proof.pdf')
    const pdf = await mainWindow.webContents.printToPDF({ pageSize: 'A4', printBackground: true })
    await writeFile(pdfPath, pdf)

    return { recordCount: row.count, pdfPath }
  })

  ipcMain.handle('auth:status', () => toIpcResult(() => ({ hasUser: Boolean(database?.prepare('SELECT 1 FROM users LIMIT 1').get()), user: getSessionUser() })))
  ipcMain.handle('auth:setup', (_event, input: unknown) => toIpcResult(async () => {
    if (!database || typeof input !== 'object' || input === null) throw new Error('INVALID_INPUT')
    if (database.prepare('SELECT 1 FROM users LIMIT 1').get()) throw new Error('SETUP_ALREADY_COMPLETE')
    const { username, displayName, password } = setupSchema.parse(input)
    const recoveryKey = createRecoveryKey()
    const [passwordHash, recoveryHash] = await Promise.all([hashSecret(password), hashSecret(recoveryKey)])
    const result = database.prepare('INSERT INTO users (username, display_name, password_hash, recovery_hash) VALUES (?, ?, ?, ?)').run(username.trim(), displayName.trim(), passwordHash, recoveryHash)
    const sessionUser = { id: Number(result.lastInsertRowid), username: username.trim(), displayName: displayName.trim() }
    login(sessionUser)
    return { recoveryKey, user: sessionUser }
  }))
  ipcMain.handle('auth:login', (_event, input: unknown) => toIpcResult(async () => {
    if (!database || typeof input !== 'object' || input === null) throw new Error('INVALID_INPUT')
    const { username, password } = loginSchema.parse(input)
    assertLoginAllowed(username)
    const user = database.prepare('SELECT id, username, display_name, password_hash FROM users WHERE username = ? COLLATE NOCASE').get(username.trim()) as { id: number; username: string; display_name: string; password_hash: string } | undefined
    if (!user || !await verifySecret(password, user.password_hash)) { recordLoginFailure(username); throw new Error('INVALID_CREDENTIALS') }
    const sessionUser = { id: user.id, username: user.username, displayName: user.display_name }
    login(sessionUser)
    clearLoginFailures(username)
    return sessionUser
  }))
  ipcMain.handle('auth:recover', (_event, input: unknown) => toIpcResult(async () => {
    if (!database) throw new Error('INVALID_INPUT')
    const { username, recoveryKey, newPassword } = recoverSchema.parse(input)
    const user = database.prepare('SELECT id, recovery_hash FROM users WHERE username = ? COLLATE NOCASE').get(username) as { id: number; recovery_hash: string } | undefined
    if (!user || !await verifySecret(recoveryKey, user.recovery_hash)) throw new Error('INVALID_CREDENTIALS')
    const newRecoveryKey = createRecoveryKey()
    const [passwordHash, recoveryHash] = await Promise.all([hashSecret(newPassword), hashSecret(newRecoveryKey)])
    database.prepare('UPDATE users SET password_hash = ?, recovery_hash = ? WHERE id = ?').run(passwordHash, recoveryHash, user.id)
    return { recoveryKey: newRecoveryKey }
  }))
  ipcMain.handle('auth:logout', () => toIpcResult(() => { logout(); return null }))
  ipcMain.handle('auth:touch', () => toIpcResult(() => { touchSession(); return getSessionUser() }))
  ipcMain.handle('auth:lockIfIdle', (_event, minutes: unknown) => toIpcResult(() => lockIfIdle(typeof minutes === 'number' ? minutes : 0)))
  ipcMain.handle('records:list', (_event, input: unknown) => toIpcResult(() => {
    requireSessionUser(); const value=input as {search?:unknown;filter?:unknown}; return listRecords(database!, typeof value?.search === 'string' ? value.search : '', typeof value?.filter === 'string' ? value.filter : '')
  }))
  ipcMain.handle('records:get', (_event, id: unknown) => toIpcResult(() => { requireSessionUser(); return getRecord(database!, Number(id)) }))
  ipcMain.handle('records:nextNumber', () => toIpcResult(() => { requireSessionUser(); return nextRecordNumber(database!) }))
  ipcMain.handle('records:legacyStatus', () => toIpcResult(() => {
    requireSessionUser()
    const settings = getSettings(database!)
    return { count: legacyRecordCount(database!), decided: settings.record_model_upgrade_decided === 'true' }
  }))
  ipcMain.handle('records:clearLegacy', () => toIpcResult(() => {
    requireSessionUser()
    const deleted = clearRecords(database!)
    setSetting(database!, 'record_model_upgrade_decided', 'true')
    return deleted
  }))
  ipcMain.handle('records:keepLegacy', () => toIpcResult(() => { requireSessionUser(); setSetting(database!, 'record_model_upgrade_decided', 'true'); return true }))
  ipcMain.handle('records:create', (_event, input: unknown) => toIpcResult(() => {
    const user = requireSessionUser(); const payload = input as { record: import('./db/repos/records').RecordInput; items: import('../shared/types').ItemInput[] }
    return saveRecord(database!, null, payload.record, payload.items, user.id)
  }))
  ipcMain.handle('records:update', (_event, input: unknown) => toIpcResult(() => {
    const user = requireSessionUser(); const payload = input as { id: number; record: import('./db/repos/records').RecordInput; items: import('../shared/types').ItemInput[] }
    return saveRecord(database!, payload.id, payload.record, payload.items, user.id)
  }))
  ipcMain.handle('records:delete', (_event, id: unknown) => toIpcResult(() => softDeleteRecord(database!, Number(id), requireSessionUser().id)))
  ipcMain.handle('records:workflow', (_event, input: unknown) => toIpcResult(() => { const value=input as {id?:unknown;stage?:unknown;enabled?:unknown}; if (!value || !Number.isInteger(value.id) || !['confirmed','paid','delivered'].includes(String(value.stage)) || typeof value.enabled !== 'boolean') throw new Error('INVALID_INPUT'); return updateWorkflow(database!, value.id as number, value.stage as 'confirmed'|'paid'|'delivered', value.enabled, requireSessionUser().id) }))
  ipcMain.handle('billing:list', () => toIpcResult(() => { requireSessionUser(); return listBilling(database!) }))
  ipcMain.handle('billing:payments', (_event, recordId: unknown) => toIpcResult(() => { requireSessionUser(); return listPayments(database!, Number(recordId)) }))
  ipcMain.handle('billing:add', (_event, input: unknown) => toIpcResult(() => {
    requireSessionUser(); const value=input as Record<string,unknown>|null
    if (!value || !Number.isInteger(value.recordId) || !Number.isInteger(value.amountMinor) || typeof value.paymentDate !== 'string') throw new Error('INVALID_INPUT')
    return addPayment(database!, {recordId:Number(value.recordId),amountMinor:Number(value.amountMinor),paymentDate:value.paymentDate,method:typeof value.method==='string'?value.method:undefined,reference:typeof value.reference==='string'?value.reference:undefined,notes:typeof value.notes==='string'?value.notes:undefined})
  }))
  ipcMain.handle('billing:delete', (_event, id: unknown) => toIpcResult(() => { requireSessionUser(); return deletePayment(database!, Number(id)) }))
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
  ipcMain.handle('dashboard:data', (_event, input: unknown) => toIpcResult(() => {
    requireSessionUser()
    const days = typeof (input as { days?: unknown })?.days === 'number' ? (input as { days: number }).days : 30
    return getDashboardData(database!, new Date().toISOString().slice(0, 10), days)
  }))
  ipcMain.handle('reports:data', (_event, input: unknown) => toIpcResult(() => {
    requireSessionUser()
    if (!input || typeof input !== 'object') throw new Error('INVALID_INPUT')
    const value = input as { type?: string; params?: ReportParams }
    if (!reportTypes.includes(value.type as ReportType)) throw new Error('INVALID_INPUT')
    return getReportData(database!, value.type as ReportType, value.params ?? {})
  }))
  ipcMain.handle('reports:exportExcel', (_event, report: unknown) => toIpcResult(() => { requireSessionUser(); if (!mainWindow || !report || typeof report !== 'object') throw new Error('INVALID_INPUT'); return exportExcel(mainWindow, report as { period: string; rows: Record<string, unknown>[]; summary: Record<string, unknown>[] }) }))
  ipcMain.handle('reports:exportPdf', (_event, report: unknown) => toIpcResult(() => { requireSessionUser(); if (!mainWindow || !report || typeof report !== 'object') throw new Error('INVALID_INPUT'); return exportPdf(mainWindow, report as { title?: string; period: string; rows: Record<string, unknown>[]; summary: Record<string, unknown>[] }) }))
  const backupDirectory = path.join(app.getPath('userData'), 'backups')
  const makeBackup = async () => {
    const file = await createBackup(database!, backupDirectory)
    applyRetention(backupDirectory)
    const driveDirectory = getSettings(database!).backup_dir_drive
    if (driveDirectory) copyBackupToDirectory(file, driveDirectory)
    return file
  }
  ipcMain.handle('backup:now', () => toIpcResult(async () => { requireSessionUser(); return makeBackup() }))
  ipcMain.handle('backup:list', () => toIpcResult(() => { requireSessionUser(); return listBackups(backupDirectory) }))
  ipcMain.handle('backup:health', () => toIpcResult(() => { requireSessionUser(); return backupHealth(backupDirectory) }))
  ipcMain.handle('backup:restore', (_event, file: unknown) => toIpcResult(() => {
    requireSessionUser()
    if (typeof file !== 'string' || !existsSync(file) || !validateBackup(file)) throw new Error('INVALID_BACKUP')
    const live = path.join(app.getPath('userData'), 'data', 'records.db')
    database?.close()
    copyFileSync(file, live)
    app.relaunch(); app.exit(0)
    return true
  }))
  setInterval(() => { if (database) void makeBackup().catch(() => undefined) }, 60 * 60 * 1000).unref()
})

app.on('second-instance', () => mainWindow?.focus())
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => database?.close())
