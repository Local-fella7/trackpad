import { contextBridge, ipcRenderer } from 'electron'

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
    create: (input: unknown) => ipcRenderer.invoke('records:create', input),
    update: (input: unknown) => ipcRenderer.invoke('records:update', input),
    remove: (id: number) => ipcRenderer.invoke('records:delete', id),
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
  dashboard: { data: () => ipcRenderer.invoke('dashboard:data') },
  reports: { data: (type: string, params?: unknown) => ipcRenderer.invoke('reports:data', { type, params }), exportExcel: (report: unknown) => ipcRenderer.invoke('reports:exportExcel', report), exportPdf: (name: string) => ipcRenderer.invoke('reports:exportPdf', name) },
  backup: { now: () => ipcRenderer.invoke('backup:now'), list: () => ipcRenderer.invoke('backup:list'), health: () => ipcRenderer.invoke('backup:health'), restore: (file: string) => ipcRenderer.invoke('backup:restore', file) },
})
