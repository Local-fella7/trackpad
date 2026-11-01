import { app, BrowserWindow, ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRecoveryKey, hashSecret, verifySecret } from './auth'
import { getSessionUser, lockIfIdle, login, logout, touchSession } from './session'
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from './login-attempts'
import { toIpcResult } from './errors'
import { loginSchema, recoverSchema, setupSchema } from './schemas'

const isDevelopment = !app.isPackaged
let mainWindow: BrowserWindow | null = null
let database: Database.Database | null = null

function openProofDatabase() {
  const dataDirectory = path.join(app.getPath('userData'), 'data')
  mkdirSync(dataDirectory, { recursive: true })

  const db = new Database(path.join(dataDirectory, 'proof.db'))
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = FULL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      recovery_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS proof_runs (
      id INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  return db
}

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

  database = openProofDatabase()
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
})

app.on('second-instance', () => mainWindow?.focus())
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => database?.close())
