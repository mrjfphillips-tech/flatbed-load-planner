import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
} from 'electron'
import * as path from 'path'
import { autoUpdater } from 'electron-updater'
import { resolveConfig } from './config'
import { handleAuth0Redirect, initiateAuth0Login, parseAuth0Redirect } from './auth'
import { deleteOpenAIKey, loadOpenAIKey, saveOpenAIKey } from './storage'
import { resolveWasmPaths } from './wasm'
import type { PKCESession } from './auth'

const isDev = process.env['NODE_ENV'] === 'development'
const config = resolveConfig()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let pkceSession: PKCESession | null = null

// ── Window ────────────────────────────────────────────────────────────────────

export function resolveWindowUrl(environment: string, devPort = 5173): string {
  if (environment === 'development') {
    return `http://localhost:${devPort}`
  }
  return `file://${path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html')}`
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    icon: path.join(__dirname, '..', '..', '..', '..', 'ptv_logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const url = resolveWindowUrl(config.environment)
  if (isDev) {
    win.loadURL(url)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'))
  }

  win.once('ready-to-show', () => win.show())

  // Minimize to tray on close
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  return win
}

// ── Tray ──────────────────────────────────────────────────────────────────────

function createTray(): Tray {
  const iconPath = path.join(__dirname, '..', '..', '..', '..', 'ptv_logo.ico')
  const icon = nativeImage.createFromPath(iconPath)
  const t = new Tray(icon)
  t.setToolTip('PTV Discovery Coach')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Restore',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  t.setContextMenu(contextMenu)

  t.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  return t
}

// ── Backend health check ──────────────────────────────────────────────────────

async function checkBackendHealth(): Promise<{ reachable: boolean; latencyMs: number }> {
  const start = Date.now()
  try {
    const response = await fetch(`${config.backendUrl}/health`, { signal: AbortSignal.timeout(5000) })
    return { reachable: response.ok, latencyMs: Date.now() - start }
  } catch {
    return { reachable: false, latencyMs: Date.now() - start }
  }
}

async function waitForBackend(timeoutMs = 10000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { reachable } = await checkBackendHealth()
    if (reachable) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('get-backend-url', () => config.backendUrl)

  ipcMain.handle('get-openai-key', () => loadOpenAIKey())

  ipcMain.handle('set-openai-key', (_event, key: string) => saveOpenAIKey(key))

  ipcMain.handle('delete-openai-key', () => deleteOpenAIKey())

  ipcMain.handle('get-wasm-paths', () => resolveWasmPaths())

  ipcMain.handle('check-backend-health', () => checkBackendHealth())

  ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdatesAndNotify())

  ipcMain.handle('initiate-auth0-login', () => {
    pkceSession = initiateAuth0Login(config)
  })
}

// ── Auth0 protocol handler ────────────────────────────────────────────────────

function handleProtocolUrl(url: string): void {
  if (!url.startsWith('ptv-discovery-coach://auth/callback')) return

  if (!pkceSession || !mainWindow) return

  handleAuth0Redirect(url, pkceSession, config)
    .then((tokens) => {
      const { extractedCode, extractedState } = parseAuth0Redirect(url)
      mainWindow!.webContents.send('auth0-redirect', extractedCode, extractedState)
      pkceSession = null
      // Send full tokens for the renderer to store
      mainWindow!.webContents.send('auth0-tokens', tokens)
    })
    .catch((err: Error) => {
      pkceSession = null
      mainWindow!.webContents.send('auth0-error', err.message)
    })
}

// ── Auto-updater ──────────────────────────────────────────────────────────────

function setupAutoUpdater(): void {
  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-available')
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded')
  })

  autoUpdater.on('error', (err: Error) => {
    console.error('Auto-updater error:', err)
  })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Register custom protocol before app is ready
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('ptv-discovery-coach', process.execPath, [
      path.resolve(process.argv[1] ?? ''),
    ])
  }
} else {
  app.setAsDefaultProtocolClient('ptv-discovery-coach')
}

// Windows: handle protocol URL passed as command-line argument
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    const url = commandLine.find((arg) => arg.startsWith('ptv-discovery-coach://'))
    if (url) handleProtocolUrl(url)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(async () => {
  registerIpcHandlers()
  setupAutoUpdater()

  mainWindow = createWindow()
  tray = createTray()

  // Health check before showing window (skip in dev)
  if (!isDev) {
    const reachable = await waitForBackend(10000)
    if (!reachable) {
      const { response: choice } = await dialog.showMessageBox({
        type: 'error',
        title: 'Cannot connect to server',
        message: 'PTV Discovery Coach could not reach the backend service.',
        detail: `Tried: ${config.backendUrl}/health\n\nIf this is a fresh install, the backend service may still be starting up — click Retry. If the problem persists, contact your IT administrator and share this URL.`,
        buttons: ['Retry', 'Quit'],
      })
      if (choice === 0) {
        app.relaunch()
        app.exit(0)
      } else {
        app.quit()
        return
      }
    }
  }

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {/* silent */})
  }
})

app.on('window-all-closed', () => {
  // Keep running in tray on Windows/Linux; quit on macOS
  if (process.platform === 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow()
  } else {
    mainWindow?.show()
  }
})

// macOS: handle protocol URL via open-url event
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleProtocolUrl(url)
})

// Extend app type for isQuitting flag
declare module 'electron' {
  interface App {
    isQuitting: boolean
  }
}
app.isQuitting = false
