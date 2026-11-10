import { contextBridge, ipcRenderer } from 'electron'

function serializeReport(report: unknown) {
  const json = JSON.stringify(report)
  if (json === undefined) throw new TypeError('Report data could not be serialized.')
  return JSON.parse(json)
}

contextBridge.exposeInMainWorld('desktopProof', {
  run: () => ipcRenderer.invoke('proof:run'),
})

contextBridge.exposeInMainWorld('api', {
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    setup: (input: unknown) => ipcRenderer.invoke('auth:setup', input),
    login: (input: unknown) => ipcRenderer.invoke('auth:login', input),
    recover: (input: unknown) => ipcRenderer.invoke('auth:recover', input),
    logout: () => ipcRenderer.invoke('auth:logout'),
    touch: () => ipcRenderer.invoke('auth:touch'),
    lockIfIdle: (minutes: number) => ipcRenderer.invoke('auth:lockIfIdle', minutes),
  },
  records: {
    list: (input?: unknown) => ipcRenderer.invoke('records:list', input),
    get: (id: number) => ipcRenderer.invoke('records:get', id),
    nextNumber: () => ipcRenderer.invoke('records:nextNumber'),
    legacyStatus: () => ipcRenderer.invoke('records:legacyStatus'),
    clearLegacy: () => ipcRenderer.invoke('records:clearLegacy'),
    keepLegacy: () => ipcRenderer.invoke('records:keepLegacy'),
    create: (input: unknown) => ipcRenderer.invoke('records:create', input),
    update: (input: unknown) => ipcRenderer.invoke('records:update', input),
    remove: (id: number) => ipcRenderer.invoke('records:delete', id),
    printItems: (id: number) => ipcRenderer.invoke('records:printItems', id),
    workflow: (input: unknown) => ipcRenderer.invoke('records:workflow', input),
  },
  statuses: {
    list: () => ipcRenderer.invoke('statuses:list'),
    create: (input: unknown) => ipcRenderer.invoke('statuses:create', input),
    update: (input: unknown) => ipcRenderer.invoke('statuses:update', input),
    reorder: (ids: number[]) => ipcRenderer.invoke('statuses:reorder', ids),
    setDefault: (id: number) => ipcRenderer.invoke('statuses:setDefault', id),
    remove: (id: number) => ipcRenderer.invoke('statuses:remove', id),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (input: unknown) => ipcRenderer.invoke('settings:set', input),
  },
  billing: {
    list: () => ipcRenderer.invoke('billing:list'),
    payments: (recordId: number) => ipcRenderer.invoke('billing:payments', recordId),
    add: (input: unknown) => ipcRenderer.invoke('billing:add', input),
    remove: (id: number) => ipcRenderer.invoke('billing:delete', id),
  },
  dashboard: { data: (input?: unknown) => ipcRenderer.invoke('dashboard:data', input) },
  reports: { data: (type: string, params?: unknown) => ipcRenderer.invoke('reports:data', { type, params }), exportExcel: (report: unknown) => ipcRenderer.invoke('reports:exportExcel', serializeReport(report)), exportPdf: (report: unknown) => ipcRenderer.invoke('reports:exportPdf', serializeReport(report)), print: (report: unknown) => ipcRenderer.invoke('reports:print', serializeReport(report)), openFolder: (file: string) => ipcRenderer.invoke('reports:openFolder', file) },
  backup: { now: () => ipcRenderer.invoke('backup:now'), list: () => ipcRenderer.invoke('backup:list'), health: () => ipcRenderer.invoke('backup:health'), restore: (file: string) => ipcRenderer.invoke('backup:restore', file) },
})
