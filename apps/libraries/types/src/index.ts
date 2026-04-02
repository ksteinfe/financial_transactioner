/**

 * Canonical shared types for the transaction corpus platform.

 */



export type ISODateString = string



export type AccountId = string



export type CategoryPath = string



/** Single normalized row in `YYYY.json` `transactions[]` (corpus contract). */

export interface CorpusTransaction {

  key: string

  date: ISODateString

  amount: number

  account: AccountId

  description: string

  category: CategoryPath

  date_created: string

  date_updated: string

  /** Optional human context (e.g. trip name, reconciliation note). Omitted when empty. */

  notes?: string

}



/** Top-level shape of each `YYYY.json` corpus file (informative; writers validate at runtime). */

export interface CorpusYearFile {

  metadata: {

    last_sync_date: string

    sources: string[]

    last_push_date: string

  }

  transactions: CorpusTransaction[]

}



/** Rollup of signed amounts: credits add to inflow, debits add to outflow; net is sum(amount). */

export interface CorpusSummaryRollup {

  inflow: number

  outflow: number

  net: number

  transaction_count: number

}



/** One calendar month bucket under a year (`YYYY-MM`). */

export interface CorpusSummaryMonthBucket extends CorpusSummaryRollup {

  major_categories: Record<string, CorpusSummaryRollup>

}



/** Year-level major category with optional minor breakdown. */

export interface CorpusSummaryYearMajorCategory extends CorpusSummaryRollup {

  minor_categories: Record<string, CorpusSummaryRollup>

}



/** Aggregates for one calendar year. */

export interface CorpusSummaryYearBucket extends CorpusSummaryRollup {

  months: Record<string, CorpusSummaryMonthBucket>

  major_categories: Record<string, CorpusSummaryYearMajorCategory>

}



/** `corpus-summary.json` — derived index; safe to overwrite. */

export interface CorpusSummaryDocument {

  _note: string

  metadata: {

    last_updated: string

    version: string

  }

  years: Record<string, CorpusSummaryYearBucket>

}



export type CorpusSummaryRebuildResult =

  | { status: 'ok'; path: string }

  | { status: 'no_folder' }

  | { status: 'error'; message: string }



/** Result of reading `corpus-summary.json` from the stored corpus folder (main process). */

export type CorpusSummaryLoadResult =

  | { status: 'no_folder' }

  | { status: 'missing' }

  | { status: 'ok'; summary: CorpusSummaryDocument }

  | { status: 'error'; message: string }



/** One row per `YYYY.json` discovered in a corpus directory. */

export interface YearTransactionCount {

  year: number

  transactionCount: number

}



export type DiagnosticSeverity = 'error' | 'warning' | 'info'



export interface CorpusScanDiagnostic {

  severity: DiagnosticSeverity

  message: string

  /** File path relative to corpus root or basename when relevant */

  path?: string

}



/** Result of scanning a corpus root directory for yearly JSON files. */

export interface CorpusScanSummary {

  rootPath: string

  years: YearTransactionCount[]

  diagnostics: CorpusScanDiagnostic[]

}

/** Result of rescanning the persisted corpus folder (shared across apps). */

export type CorpusRescanResult =

  | { status: 'ok'; summary: CorpusScanSummary }

  | { status: 'no_folder' }



/** Result of loading a single `YYYY.json` from the stored corpus folder (main process). */

export type CorpusYearFileLoadResult =

  | { status: 'no_folder' }

  | { status: 'missing_file'; year: number }

  | { status: 'error'; message: string; path?: string }

  | { status: 'ok'; file: CorpusYearFile; diagnostics: CorpusScanDiagnostic[] }

