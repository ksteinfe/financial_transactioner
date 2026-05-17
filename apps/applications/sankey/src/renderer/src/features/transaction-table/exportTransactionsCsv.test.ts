import { describe, expect, it } from 'vitest'
import type { CorpusTransaction } from '@txn/types'
import { transactionsToCsv } from './exportTransactionsCsv.js'

function tx(overrides: Partial<CorpusTransaction> & Pick<CorpusTransaction, 'key'>): CorpusTransaction {
  const d = '2025-06-15'
  return {
    key: overrides.key,
    date: overrides.date ?? d,
    amount: overrides.amount ?? 10,
    account: overrides.account ?? 'acct',
    description: overrides.description ?? 'desc',
    category: overrides.category ?? 'food:grocery',
    date_created: d,
    date_updated: d,
    ...overrides
  }
}

describe('transactionsToCsv', () => {
  it('always includes notes column in header and rows', () => {
    const csv = transactionsToCsv([tx({ key: '1' })])
    expect(csv).toBe('date,amount,account,category,description,notes\n2025-06-15,10,acct,food:grocery,desc,')
  })

  it('fills notes when present', () => {
    const csv = transactionsToCsv([tx({ key: '2', notes: 'trip note' })])
    expect(csv).toContain(',trip note')
  })

  it('escapes commas and quotes in fields', () => {
    const csv = transactionsToCsv([tx({ key: '1', description: 'a,b', notes: 'say "hi"' })])
    expect(csv).toContain('"a,b"')
    expect(csv).toContain('"say ""hi"""')
  })
})
