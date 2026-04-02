/// <reference types="vite/client" />

import type { AppManifest } from '@txn/app-contracts'
import type {
  CorpusRescanResult,
  CorpusScanSummary,
  CorpusSummaryLoadResult,
  CorpusSummaryRebuildResult,
  CorpusYearFileLoadResult
} from '@txn/types'

declare global {
  interface Window {
    platform: {
      getAppVersion: () => Promise<string>
      checkForUpdates: () => Promise<unknown>
      chooseCorpusFolder: () => Promise<string | null>
      getStoredCorpusFolder: () => Promise<string | null>
      setStoredCorpusFolder: (folder: string | null) => Promise<void>
      scanCorpus: (rootPath: string) => Promise<CorpusScanSummary>
      rescanCorpus: () => Promise<CorpusRescanResult>
      rebuildCorpusSummary: () => Promise<CorpusSummaryRebuildResult>
      getCorpusSummary: () => Promise<CorpusSummaryLoadResult>
      loadCorpusYearFile: (year: number) => Promise<CorpusYearFileLoadResult>
      getManifest: () => AppManifest
    }
  }
}

export {}
