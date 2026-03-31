import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CorpusScanDiagnostic, CorpusScanSummary, YearTransactionCount } from '@txn/types'

const YEAR_FILE = /^(\d{4})\.json$/

interface ParsedYearFile {
  transactions?: unknown
  metadata?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * List `YYYY.json` files in a corpus directory and count transactions per year.
 * Does not mutate disk. Surfaces parse/shape issues as diagnostics.
 */
export async function scanCorpusDirectory(rootPath: string): Promise<CorpusScanSummary> {
  const diagnostics: CorpusScanDiagnostic[] = []
  const years: YearTransactionCount[] = []

  let entries: string[]
  try {
    entries = await readdir(rootPath)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    diagnostics.push({
      severity: 'error',
      message: `Cannot read corpus directory: ${message}`,
      path: rootPath
    })
    return { rootPath, years, diagnostics }
  }

  const yearFiles = entries
    .map((name) => {
      const m = YEAR_FILE.exec(name)
      return m ? { name, year: Number.parseInt(m[1], 10) } : null
    })
    .filter((x): x is { name: string; year: number } => x !== null)
    .sort((a, b) => a.year - b.year)

  for (const { name, year } of yearFiles) {
    const filePath = join(rootPath, name)
    let raw: string
    try {
      raw = await readFile(filePath, 'utf8')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      diagnostics.push({
        severity: 'error',
        message: `Cannot read file: ${message}`,
        path: name
      })
      years.push({ year, transactionCount: 0 })
      continue
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      diagnostics.push({
        severity: 'error',
        message: `Invalid JSON: ${message}`,
        path: name
      })
      years.push({ year, transactionCount: 0 })
      continue
    }

    if (!isRecord(parsed)) {
      diagnostics.push({
        severity: 'error',
        message: 'Year file must be a JSON object',
        path: name
      })
      years.push({ year, transactionCount: 0 })
      continue
    }

    const doc = parsed as ParsedYearFile
    if (doc.metadata === undefined) {
      diagnostics.push({
        severity: 'warning',
        message: 'Missing metadata object (see corpus-format contract)',
        path: name
      })
    }

    if (!Array.isArray(doc.transactions)) {
      diagnostics.push({
        severity: 'error',
        message: 'Missing or invalid transactions array',
        path: name
      })
      years.push({ year, transactionCount: 0 })
      continue
    }

    years.push({ year, transactionCount: doc.transactions.length })
  }

  return { rootPath, years, diagnostics }
}
