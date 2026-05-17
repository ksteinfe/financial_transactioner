import { describe, expect, it } from 'vitest'
import type { CorpusTransaction } from '@txn/types'
import { computeFilterBounds } from './filterBounds.js'
import {
  applyTransactionFilters,
  EMPTY_FILTERS,
  isColumnFilterActive
} from './transactionFilters.js'

function tx(
  overrides: Partial<CorpusTransaction> & Pick<CorpusTransaction, 'key' | 'date' | 'amount' | 'category'>
): CorpusTransaction {
  const d = overrides.date
  return {
    account: 'checking',
    description: 'x',
    date_created: d,
    date_updated: d,
    ...overrides
  } as CorpusTransaction
}

describe('applyTransactionFilters', () => {
  const rows = [
    tx({ key: '1', date: '2025-01-10', amount: 100, category: 'food:grocery', account: 'a' }),
    tx({ key: '2', date: '2025-02-15', amount: -50, category: 'rent:monthly', account: 'b' }),
    tx({ key: '3', date: '2025-03-20', amount: 200, category: 'food:restaurant', account: 'a' })
  ]
  const bounds = computeFilterBounds(rows)

  it('filters by date range', () => {
    const filtered = applyTransactionFilters(rows, {
      ...EMPTY_FILTERS,
      date: { start: '2025-02-01', end: '2025-03-01' }
    })
    expect(filtered.map((t) => t.key)).toEqual(['2'])
  })

  it('filters by amount range', () => {
    const filtered = applyTransactionFilters(rows, {
      ...EMPTY_FILTERS,
      amount: { min: 0, max: 250 }
    })
    expect(filtered.map((t) => t.key)).toEqual(['1', '3'])
  })

  it('filters by selected accounts', () => {
    const filtered = applyTransactionFilters(rows, {
      ...EMPTY_FILTERS,
      accounts: new Set(['b'])
    })
    expect(filtered.map((t) => t.key)).toEqual(['2'])
  })

  it('filters by selected categories', () => {
    const filtered = applyTransactionFilters(rows, {
      ...EMPTY_FILTERS,
      categories: new Set(['food:grocery', 'food:restaurant'])
    })
    expect(filtered.map((t) => t.key)).toEqual(['1', '3'])
  })

  it('reports active column filters', () => {
    expect(isColumnFilterActive('date', EMPTY_FILTERS, bounds)).toBe(false)
    expect(
      isColumnFilterActive(
        'account',
        { ...EMPTY_FILTERS, accounts: new Set(['a']) },
        bounds
      )
    ).toBe(true)
  })
})
