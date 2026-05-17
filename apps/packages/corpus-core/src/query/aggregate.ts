import type { CorpusTransaction } from '@txn/types'
import { parseCategory } from '../category.js'

export interface CategoryAggregate {
  category: string
  major: string
  total: number
}

/** Per-category positive and negative totals kept separate (for reimbursement / transfer Sankey). */
export interface CategorySignSplit {
  category: string
  major: string
  inflow: number
  outflow: number
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

/**
 * Sum positives and negatives separately per category (no netting).
 */
export function aggregateByCategorySplitSign(transactions: CorpusTransaction[]): CategorySignSplit[] {
  const inflow = new Map<string, number>()
  const outflow = new Map<string, number>()
  for (const tx of transactions) {
    const c = tx.category
    if (tx.amount > 0) {
      inflow.set(c, (inflow.get(c) ?? 0) + tx.amount)
    } else if (tx.amount < 0) {
      outflow.set(c, (outflow.get(c) ?? 0) + Math.abs(tx.amount))
    }
  }
  const categories = new Set([...inflow.keys(), ...outflow.keys()])
  const out: CategorySignSplit[] = []
  for (const category of categories) {
    const inf = inflow.get(category) ?? 0
    const outf = outflow.get(category) ?? 0
    if (inf === 0 && outf === 0) continue
    const { major } = parseCategory(category)
    out.push({ category, major, inflow: inf, outflow: outf })
  }
  return out
}
