import type { CorpusScanDiagnostic, CorpusYearFile } from '@txn/types'
import { parseCategory } from './category.js'
import { parseTransactionRow } from './transaction.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function defaultMetadata(): CorpusYearFile['metadata'] {
  const now = new Date().toISOString()
  return {
    last_sync_date: now,
    sources: [],
    last_push_date: now
  }
}

/**
 * Parse a full year JSON file string into a `CorpusYearFile` plus diagnostics for skipped rows.
 */
export function parseCorpusYearFile(raw: string, pathLabel: string): {
  file: CorpusYearFile
  diagnostics: CorpusScanDiagnostic[]
} {
  const diagnostics: CorpusScanDiagnostic[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    diagnostics.push({ severity: 'error', message: `Invalid JSON: ${message}`, path: pathLabel })
    return { file: { metadata: defaultMetadata(), transactions: [] }, diagnostics }
  }

  if (!isRecord(parsed)) {
    diagnostics.push({ severity: 'error', message: 'Year file must be a JSON object', path: pathLabel })
    return { file: { metadata: defaultMetadata(), transactions: [] }, diagnostics }
  }

  let metadata: CorpusYearFile['metadata'] = defaultMetadata()
  const metaRaw = parsed.metadata
  if (metaRaw === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: 'Missing metadata object (see corpus-format contract)',
      path: pathLabel
    })
  } else if (!isRecord(metaRaw)) {
    diagnostics.push({
      severity: 'warning',
      message: 'Invalid metadata object; using defaults',
      path: pathLabel
    })
  } else {
    const last_sync_date =
      typeof metaRaw.last_sync_date === 'string' ? metaRaw.last_sync_date : metadata.last_sync_date
    const last_push_date =
      typeof metaRaw.last_push_date === 'string' ? metaRaw.last_push_date : metadata.last_push_date
    const sources = Array.isArray(metaRaw.sources)
      ? metaRaw.sources.filter((s): s is string => typeof s === 'string')
      : []
    metadata = { last_sync_date, sources, last_push_date }
  }

  if (!Array.isArray(parsed.transactions)) {
    diagnostics.push({ severity: 'error', message: 'Missing or invalid transactions array', path: pathLabel })
    return { file: { metadata, transactions: [] }, diagnostics }
  }

  const transactions: CorpusYearFile['transactions'] = []
  let index = 0
  for (const row of parsed.transactions) {
    const tx = parseTransactionRow(row)
    if (!tx) {
      diagnostics.push({
        severity: 'warning',
        message: `Skipping invalid transaction at index ${index}`,
        path: pathLabel
      })
      index += 1
      continue
    }
    // Validate category shape for downstream consumers (major:minor)
    void parseCategory(tx.category)
    transactions.push(tx)
    index += 1
  }

  return { file: { metadata, transactions }, diagnostics }
}
