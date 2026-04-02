import type { CorpusTransaction } from '@txn/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse one transaction object from JSON. Returns null if the row is invalid.
 */
export function parseTransactionRow(raw: unknown): CorpusTransaction | null {
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
