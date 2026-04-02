import { contextBridge, ipcRenderer } from 'electron'
import type { AppManifest } from '@txn/app-contracts'
import { readerCapabilities } from '@txn/app-contracts'
import type {
  CorpusRescanResult,
  CorpusScanSummary,
  CorpusSummaryLoadResult,
  CorpusSummaryRebuildResult,
  CorpusYearFile,
  CorpusYearFileLoadResult
} from '@txn/types'
import pkg from '../../package.json'

export interface PlatformSankeyApi {
  getAppVersion: () => Promise<string>
  checkForUpdates: () => Promise<CheckForUpdatesResult>
  chooseCorpusFolder: () => Promise<string | null>
  getStoredCorpusFolder: () => Promise<string | null>
  setStoredCorpusFolder: (folder: string | null) => Promise<void>
  scanCorpus: (rootPath: string) => Promise<CorpusScanSummary>
  rescanCorpus: () => Promise<CorpusRescanResult>
  rebuildCorpusSummary: () => Promise<CorpusSummaryRebuildResult>
  getCorpusSummary: () => Promise<CorpusSummaryLoadResult>
  /** Load one `YYYY.json` from the stored corpus folder. */
  loadCorpusYearFile: (year: number) => Promise<CorpusYearFileLoadResult>
  getManifest: () => AppManifest
}

export type CheckForUpdatesResult =
  | { status: 'skipped'; reason: string }
  | { status: 'ok'; version?: string }
  | { status: 'error'; message: string }

const manifest: AppManifest = {
  id: 'steinfeld-finance-sankey',
  name: 'Steinfeld Finance - Sankey',
  version: pkg.version,
  capabilities: readerCapabilities
}

const platform: PlatformSankeyApi = {
  getAppVersion: () => ipcRenderer.invoke('platform:getAppVersion'),
  checkForUpdates: () => ipcRenderer.invoke('platform:checkForUpdates'),
  chooseCorpusFolder: () => ipcRenderer.invoke('platform:chooseCorpusFolder'),
  getStoredCorpusFolder: () => ipcRenderer.invoke('platform:getStoredCorpusFolder'),
  setStoredCorpusFolder: (folder) => ipcRenderer.invoke('platform:setStoredCorpusFolder', folder),
  scanCorpus: (rootPath) => ipcRenderer.invoke('platform:scanCorpus', rootPath),
  rescanCorpus: () => ipcRenderer.invoke('platform:rescanCorpus'),
  rebuildCorpusSummary: () => ipcRenderer.invoke('platform:rebuildCorpusSummary'),
  getCorpusSummary: () => ipcRenderer.invoke('platform:getCorpusSummary'),
  loadCorpusYearFile: (year: number) => ipcRenderer.invoke('platform:loadCorpusYearFile', year),
  getManifest: () => manifest
}

contextBridge.exposeInMainWorld('platform', platform)
