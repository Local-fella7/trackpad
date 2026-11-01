import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktopProof', {
  run: () => ipcRenderer.invoke('proof:run'),
})
