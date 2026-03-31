import { contextBridge, ipcRenderer } from 'electron'
import type { AppManifest } from '@txn/app-contracts'
import { readerCapabilities } from '@txn/app-contracts'
import type { CorpusRescanResult, CorpusScanSummary } from '@txn/types'
import pkg from '../../package.json'

/**
 * Reader-only preload surface for the hello-world shell.
 * Editor-only channels must not be registered here — use a separate preload entry for editor builds.
 */
export interface PlatformReaderApi {
  getAppVersion: () => Promise<string>
  checkForUpdates: () => Promise<CheckForUpdatesResult>
  chooseCorpusFolder: () => Promise<string | null>
  getStoredCorpusFolder: () => Promise<string | null>
  setStoredCorpusFolder: (folder: string | null) => Promise<void>
  scanCorpus: (rootPath: string) => Promise<CorpusScanSummary>
  /** Re-scan the persisted corpus folder; use after external file changes or on load. */
  rescanCorpus: () => Promise<CorpusRescanResult>
  getManifest: () => AppManifest
}

export type CheckForUpdatesResult =
  | { status: 'skipped'; reason: string }
  | { status: 'ok'; version?: string }
  | { status: 'error'; message: string }

const manifest: AppManifest = {
  id: 'steinfeld-finance-hello',
  name: 'Steinfeld Finance - Hello',
  version: pkg.version,
  capabilities: readerCapabilities
}

const platform: PlatformReaderApi = {
  getAppVersion: () => ipcRenderer.invoke('platform:getAppVersion'),
  checkForUpdates: () => ipcRenderer.invoke('platform:checkForUpdates'),
  chooseCorpusFolder: () => ipcRenderer.invoke('platform:chooseCorpusFolder'),
  getStoredCorpusFolder: () => ipcRenderer.invoke('platform:getStoredCorpusFolder'),
  setStoredCorpusFolder: (folder) => ipcRenderer.invoke('platform:setStoredCorpusFolder', folder),
  scanCorpus: (rootPath) => ipcRenderer.invoke('platform:scanCorpus', rootPath),
  rescanCorpus: () => ipcRenderer.invoke('platform:rescanCorpus'),
  getManifest: () => manifest
}

contextBridge.exposeInMainWorld('platform', platform)
