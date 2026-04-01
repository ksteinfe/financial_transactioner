import { randomBytes } from 'node:crypto'
import { readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  CorpusSummaryDocument,
  CorpusSummaryMonthBucket,
  CorpusSummaryRollup,
  CorpusSummaryYearBucket,
  CorpusSummaryYearMajorCategory,
  CorpusTransaction
} from '@txn/types'
import { CORPUS_SUMMARY_FILENAME, CORPUS_SUMMARY_SCHEMA_VERSION } from './constants.js'
import { DEFAULT_MAJOR_CATEGORY_KEYS } from './majors.js'

const YEAR_FILE = /^(\d{4})\.json$/

const SUMMARY_NOTE =
  'This file is automatically maintained by the system. Do not edit manually.'

interface MutableRollup {
  inflow: number
  outflow: number
  net: number
  transaction_count: number
}

function emptyRollup(): MutableRollup {
  return { inflow: 0, outflow: 0, net: 0, transaction_count: 0 }
}

function addAmount(r: MutableRollup, amount: number): void {
  if (amount > 0) r.inflow += amount
  else if (amount < 0) r.outflow += -amount
  r.net += amount
  r.transaction_count += 1
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function finalizeRollup(r: MutableRollup): CorpusSummaryRollup {
  return {
    inflow: round2(r.inflow),
    outflow: round2(r.outflow),
    net: round2(r.net),
    transaction_count: r.transaction_count
  }
}

function parseCategory(category: string): { major: string; minor: string } {
  const i = category.indexOf(':')
  if (i <= 0) return { major: 'unknown', minor: 'undefined' }
  const major = category.slice(0, i).trim()
  const minor = category.slice(i + 1).trim()
  if (major.length === 0) return { major: 'unknown', minor: minor.length > 0 ? minor : 'undefined' }
  return { major, minor: minor.length > 0 ? minor : 'undefined' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asTransaction(raw: unknown): CorpusTransaction | null {
  if (!isRecord(raw)) return null
  const key = raw.key
  const date = raw.date
  const amount = raw.amount
  const account = raw.account
  const description = raw.description
  const category = raw.category
  const date_created = raw.date_created
  const date_updated = raw.date_updated
  if (
    typeof key !== 'string' ||
    typeof date !== 'string' ||
    typeof amount !== 'number' ||
    Number.isNaN(amount) ||
    typeof account !== 'string' ||
    typeof description !== 'string' ||
    typeof category !== 'string' ||
    typeof date_created !== 'string' ||
    typeof date_updated !== 'string'
  ) {
    return null
  }
  const notes = raw.notes
  const tx: CorpusTransaction = {
    key,
    date,
    amount,
    account,
    description,
    category,
    date_created,
    date_updated
  }
  if (typeof notes === 'string' && notes.length > 0) {
    tx.notes = notes
  }
  return tx
}

function monthKeyFromDate(isoDate: string): string | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate.trim())
  if (!m) return null
  return `${m[1]}-${m[2]}`
}

function sortKeys<T>(obj: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {}
  for (const k of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
    out[k] = obj[k]
  }
  return out
}

function majorKeySet(): Set<string> {
  return new Set(DEFAULT_MAJOR_CATEGORY_KEYS)
}

/**
 * Reads all `YYYY.json` files under `rootPath`, aggregates transactions, and returns
 * a `CorpusSummaryDocument` suitable for writing as `corpus-summary.json`.
 */
export async function computeCorpusSummary(rootPath: string): Promise<CorpusSummaryDocument> {
  let entries: string[]
  try {
    entries = await readdir(rootPath)
  } catch {
    return makeEmptySummaryDocument()
  }

  const yearFiles = entries
    .map((name) => {
      const m = YEAR_FILE.exec(name)
      return m ? { name, year: m[1] } : null
    })
    .filter((x): x is { name: string; year: string } => x !== null)
    .sort((a, b) => a.year.localeCompare(b.year))

  /** year string -> year bucket builders */
  const yearBuilders = new Map<
    string,
    {
      totals: MutableRollup
      months: Map<string, { totals: MutableRollup; majors: Map<string, MutableRollup> }>
      yearMajors: Map<string, { totals: MutableRollup; minors: Map<string, MutableRollup> }>
    }
  >()

  const defaultMajors = majorKeySet()

  for (const { name, year } of yearFiles) {
    const filePath = join(rootPath, name)
    let raw: string
    try {
      raw = await readFile(filePath, 'utf8')
    } catch {
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch {
      continue
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.transactions)) continue

    let yb = yearBuilders.get(year)
    if (!yb) {
      yb = {
        totals: emptyRollup(),
        months: new Map(),
        yearMajors: new Map()
      }
      yearBuilders.set(year, yb)
    }

    for (const row of parsed.transactions) {
      const tx = asTransaction(row)
      if (!tx) continue

      const amount = tx.amount
      const { major, minor } = parseCategory(tx.category)
      if (!defaultMajors.has(major)) defaultMajors.add(major)

      addAmount(yb.totals, amount)

      let ym = yb.yearMajors.get(major)
      if (!ym) {
        ym = { totals: emptyRollup(), minors: new Map() }
        yb.yearMajors.set(major, ym)
      }
      addAmount(ym.totals, amount)
      let yminor = ym.minors.get(minor)
      if (!yminor) {
        yminor = emptyRollup()
        ym.minors.set(minor, yminor)
      }
      addAmount(yminor, amount)

      const mk = monthKeyFromDate(tx.date)
      if (!mk) continue

      let monthEntry = yb.months.get(mk)
      if (!monthEntry) {
        monthEntry = { totals: emptyRollup(), majors: new Map() }
        yb.months.set(mk, monthEntry)
      }
      addAmount(monthEntry.totals, amount)

      for (const m of defaultMajors) {
        if (!monthEntry.majors.has(m)) {
          monthEntry.majors.set(m, emptyRollup())
        }
      }
      let majRollup = monthEntry.majors.get(major)
      if (!majRollup) {
        majRollup = emptyRollup()
        monthEntry.majors.set(major, majRollup)
      }
      addAmount(majRollup, amount)
    }
  }

  const yearsOut: Record<string, CorpusSummaryYearBucket> = {}

  for (const [yearStr, yb] of [...yearBuilders.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const monthsOut: Record<string, CorpusSummaryMonthBucket> = {}
    for (const [mk, mb] of [...yb.months.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const major_categories: Record<string, CorpusSummaryRollup> = {}
      for (const [maj, roll] of [...mb.majors.entries()].sort((a, b) =>
        a[0].localeCompare(b[0])
      )) {
        major_categories[maj] = finalizeRollup(roll)
      }
      monthsOut[mk] = {
        ...finalizeRollup(mb.totals),
        major_categories
      }
    }

    const major_categories: Record<string, CorpusSummaryYearMajorCategory> = {}
    for (const [maj, block] of [...yb.yearMajors.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const minor_categories: Record<string, CorpusSummaryRollup> = {}
      for (const [min, mr] of [...block.minors.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        minor_categories[min] = finalizeRollup(mr)
      }
      major_categories[maj] = {
        ...finalizeRollup(block.totals),
        minor_categories
      }
    }

    yearsOut[yearStr] = {
      ...finalizeRollup(yb.totals),
      months: sortKeys(monthsOut),
      major_categories: sortKeys(major_categories)
    }
  }

  return {
    _note: SUMMARY_NOTE,
    metadata: {
      last_updated: new Date().toISOString(),
      version: CORPUS_SUMMARY_SCHEMA_VERSION
    },
    years: sortKeys(yearsOut)
  }
}

function makeEmptySummaryDocument(): CorpusSummaryDocument {
  return {
    _note: SUMMARY_NOTE,
    metadata: {
      last_updated: new Date().toISOString(),
      version: CORPUS_SUMMARY_SCHEMA_VERSION
    },
    years: {}
  }
}

/**
 * Writes `doc` to `{rootPath}/{CORPUS_SUMMARY_FILENAME}` using a temp file + rename.
 */
export async function writeCorpusSummaryFile(rootPath: string, doc: CorpusSummaryDocument): Promise<string> {
  const target = join(rootPath, CORPUS_SUMMARY_FILENAME)
  const tmp = `${target}.${randomBytes(8).toString('hex')}.tmp`
  const payload = `${JSON.stringify(doc, null, 2)}\n`
  await writeFile(tmp, payload, 'utf8')
  await rename(tmp, target)
  return target
}

/**
 * Recomputes the summary from all year files and writes it to disk.
 */
export async function rebuildCorpusSummaryFile(rootPath: string): Promise<string> {
  const doc = await computeCorpusSummary(rootPath)
  return writeCorpusSummaryFile(rootPath, doc)
}
