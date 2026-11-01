import { app, BrowserWindow, ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

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
})

app.on('second-instance', () => mainWindow?.focus())
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => database?.close())
