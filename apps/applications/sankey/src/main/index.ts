import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CORPUS_SUMMARY_FILENAME,
  parseCorpusYearFile,
  rebuildCorpusSummaryFile,
  scanCorpusDirectory
} from '@txn/corpus-core'
import type { CorpusSummaryDocument } from '@txn/types'
import electronUpdater from 'electron-updater'
import { readStoredCorpusFolder, writeStoredCorpusFolder } from './settings'

const { autoUpdater } = electronUpdater

let autoUpdaterListenersAttached = false

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCorpusSummaryShape(value: unknown): value is CorpusSummaryDocument {
  if (!isRecord(value)) return false
  const meta = value.metadata
  const years = value.years
  if (!isRecord(meta)) return false
  if (typeof meta.last_updated !== 'string' || typeof meta.version !== 'string') return false
  if (!isRecord(years)) return false
  return true
}

function isUpdateEnabled(): boolean {
  if (!app.isPackaged) return false
  const v = process.env.TXN_AUTO_UPDATE?.toLowerCase()
  if (v === '0' || v === 'false' || v === 'no') return false
  return true
}

function configureAutoUpdater(): void {
  const baseUrl = process.env.TXN_UPDATE_URL?.trim()
  if (baseUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: baseUrl })
  }
}

function attachAutoUpdaterListeners(win: BrowserWindow): void {
  if (autoUpdaterListenersAttached || !isUpdateEnabled()) return
  autoUpdaterListenersAttached = true

  autoUpdater.autoDownload = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('error', (err) => {
    console.error('[autoUpdater]', err)
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[autoUpdater] update available:', info.version)
  })

  autoUpdater.on('update-downloaded', async () => {
    const parent = BrowserWindow.getFocusedWindow() ?? win
    const { response } = await dialog.showMessageBox(parent, {
      type: 'info',
      title: 'Update ready',
      message: 'A new version has been downloaded. Restart now to install?',
      buttons: ['Restart', 'Later'],
      defaultId: 0,
      cancelId: 1
    })
    if (response === 0) {
      autoUpdater.quitAndInstall(false, true)
    }
  })

  queueMicrotask(() => {
    void autoUpdater.checkForUpdates().catch((err) => {
      console.error('[autoUpdater] checkForUpdates failed:', err)
    })
  })
}

function resolveWindowIcon(): Electron.NativeImage | undefined {
  if (app.isPackaged) {
    if (process.platform === 'win32') {
      for (const name of ['app.ico', 'icon.ico'] as const) {
        const p = join(process.resourcesPath, name)
        if (existsSync(p)) {
          return nativeImage.createFromPath(p)
        }
      }
    } else if (process.platform === 'darwin') {
      const icns = join(process.resourcesPath, 'icon.icns')
      if (existsSync(icns)) {
        return nativeImage.createFromPath(icns)
      }
    }
    return undefined
  }
  const png = join(__dirname, '../../build/sankey.png')
  return existsSync(png) ? nativeImage.createFromPath(png) : undefined
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    show: false,
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  configureAutoUpdater()

  ipcMain.handle('platform:getAppVersion', () => app.getVersion())

  ipcMain.handle('platform:checkForUpdates', async () => {
    if (!app.isPackaged) {
      return {
        status: 'skipped' as const,
        reason: 'development / unpackaged build'
      }
    }
    if (!isUpdateEnabled()) {
      return {
        status: 'skipped' as const,
        reason: 'TXN_AUTO_UPDATE=0 disables updates'
      }
    }
    try {
      const result = await autoUpdater.checkForUpdates()
      return {
        status: 'ok' as const,
        version: result?.updateInfo?.version
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { status: 'error' as const, message }
    }
  })

  ipcMain.handle('platform:chooseCorpusFolder', async () => {
    const focused = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(focused ?? undefined, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle('platform:getStoredCorpusFolder', () => readStoredCorpusFolder())

  ipcMain.handle('platform:setStoredCorpusFolder', (_event, folder: unknown) => {
    if (folder === null || folder === undefined) {
      writeStoredCorpusFolder(null)
      return
    }
    if (typeof folder === 'string') {
      writeStoredCorpusFolder(folder)
      return
    }
    throw new TypeError('setStoredCorpusFolder: expected string | null')
  })

  ipcMain.handle('platform:scanCorpus', async (_event, rootPath: unknown) => {
    if (typeof rootPath !== 'string' || rootPath.length === 0) {
      throw new TypeError('scanCorpus: expected non-empty string path')
    }
    return scanCorpusDirectory(rootPath)
  })

  ipcMain.handle('platform:rescanCorpus', async () => {
    const rootPath = readStoredCorpusFolder()
    if (rootPath === null || rootPath.length === 0) {
      return { status: 'no_folder' as const }
    }
    const summary = await scanCorpusDirectory(rootPath)
    return { status: 'ok' as const, summary }
  })

  ipcMain.handle('platform:rebuildCorpusSummary', async () => {
    const rootPath = readStoredCorpusFolder()
    if (rootPath === null || rootPath.length === 0) {
      return { status: 'no_folder' as const }
    }
    try {
      const path = await rebuildCorpusSummaryFile(rootPath)
      return { status: 'ok' as const, path }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { status: 'error' as const, message }
    }
  })

  ipcMain.handle('platform:getCorpusSummary', async () => {
    const rootPath = readStoredCorpusFolder()
    if (rootPath === null || rootPath.length === 0) {
      return { status: 'no_folder' as const }
    }
    const filePath = join(rootPath, CORPUS_SUMMARY_FILENAME)
    if (!existsSync(filePath)) {
      return { status: 'missing' as const }
    }
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      if (!isCorpusSummaryShape(parsed)) {
        return {
          status: 'error' as const,
          message: 'corpus-summary.json is missing required fields (metadata, years)'
        }
      }
      return { status: 'ok' as const, summary: parsed }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { status: 'error' as const, message }
    }
  })

  ipcMain.handle('platform:loadCorpusYearFile', async (_event, year: unknown) => {
    if (typeof year !== 'number' || !Number.isFinite(year)) {
      throw new TypeError('loadCorpusYearFile: expected finite number year')
    }
    const y = Math.trunc(year)
    const rootPath = readStoredCorpusFolder()
    if (rootPath === null || rootPath.length === 0) {
      return { status: 'no_folder' as const }
    }
    const basename = `${y}.json`
    const filePath = join(rootPath, basename)
    if (!existsSync(filePath)) {
      return { status: 'missing_file' as const, year: y }
    }
    try {
      const raw = await readFile(filePath, 'utf8')
      const { file, diagnostics } = parseCorpusYearFile(raw, basename)
      return { status: 'ok' as const, file, diagnostics }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { status: 'error' as const, message, path: basename }
    }
  })

  const win = createWindow()
  attachAutoUpdaterListeners(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const w = createWindow()
      attachAutoUpdaterListeners(w)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
