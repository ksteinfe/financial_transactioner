import type { CorpusTransaction } from '@txn/types'
import { parseCategory } from '../category.js'

export interface CategoryAggregate {
  category: string
  major: string
  total: number
}

/**
 * Sum amounts by exact category string.
 */
export function aggregateByCategory(transactions: CorpusTransaction[]): CategoryAggregate[] {
  const sums = new Map<string, number>()
  for (const tx of transactions) {
    const c = tx.category
    sums.set(c, (sums.get(c) ?? 0) + tx.amount)
  }
  const out: CategoryAggregate[] = []
  for (const [category, total] of sums) {
    const { major } = parseCategory(category)
    out.push({ category, major, total })
  }
  return out
}
