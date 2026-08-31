import { contextBridge, ipcRenderer } from 'electron'
import type { WasmPaths } from './wasm'

const electronAPI = {
  getBackendUrl: (): Promise<string> =>
    ipcRenderer.invoke('get-backend-url'),

  getOpenAIKey: (): Promise<string | null> =>
    ipcRenderer.invoke('get-openai-key'),

  setOpenAIKey: (key: string): Promise<void> =>
    ipcRenderer.invoke('set-openai-key', key),

  deleteOpenAIKey: (): Promise<void> =>
    ipcRenderer.invoke('delete-openai-key'),

  getWasmPaths: (): Promise<WasmPaths> =>
    ipcRenderer.invoke('get-wasm-paths'),

  checkBackendHealth: (): Promise<{ reachable: boolean; latencyMs: number }> =>
    ipcRenderer.invoke('check-backend-health'),

  checkForUpdates: (): Promise<void> =>
    ipcRenderer.invoke('check-for-updates'),

  onUpdateAvailable: (callback: () => void): void => {
    ipcRenderer.on('update-available', callback)
  },

  onUpdateDownloaded: (callback: () => void): void => {
    ipcRenderer.on('update-downloaded', callback)
  },

  onAuth0Redirect: (callback: (code: string, state: string) => void): void => {
    ipcRenderer.on('auth0-redirect', (_event, code: string, state: string) => callback(code, state))
  },

  onAuth0Error: (callback: (message: string) => void): void => {
    ipcRenderer.on('auth0-error', (_event, message: string) => callback(message))
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}
