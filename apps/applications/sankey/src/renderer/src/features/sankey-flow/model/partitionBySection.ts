import { sectionForCategory, type SankeySectionId } from '@txn/corpus-core/pure'
import type { CorpusTransaction } from '@txn/types'

export function partitionBySection(
  transactions: CorpusTransaction[]
): Record<SankeySectionId, CorpusTransaction[]> {
  const buckets: Record<SankeySectionId, CorpusTransaction[]> = {
    main: [],
    reimbursement: [],
    transfer: []
  }
  for (const tx of transactions) {
    const s = sectionForCategory(tx.category)
    buckets[s].push(tx)
  }
  return buckets
}
