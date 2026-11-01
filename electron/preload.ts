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
})
