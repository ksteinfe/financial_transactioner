import { describe, expect, it } from 'vitest'
import type { CorpusTransaction } from '@txn/types'
import { DEEP_SAVINGS_ACCOUNTS, excludeAccounts } from './deepSavingsFilter.js'

function tx(account: string, key: string): CorpusTransaction {
  const d = '2025-06-15'
  return {
    key,
    date: d,
    amount: -10,
    account,
    description: 'x',
    category: 'food:grocery',
    date_created: d,
    date_updated: d
  }
}

describe('excludeAccounts', () => {
  it('removes transactions for listed accounts', () => {
    const rows = [
      tx('boa_check_6934', '1'),
      tx('boa_savings_1816', '2'),
      tx('chase', '3')
    ]
    const out = excludeAccounts(rows, DEEP_SAVINGS_ACCOUNTS)
    expect(out.map((t) => t.key)).toEqual(['1', '3'])
  })

  it('returns all rows when account list is empty', () => {
    const rows = [tx('boa_savings_1816', '1')]
    expect(excludeAccounts(rows, [])).toHaveLength(1)
  })
})
