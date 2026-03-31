/**

 * Canonical shared types for the transaction corpus platform.

 */



export type ISODateString = string



export type AccountId = string



export type CategoryPath = string



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


