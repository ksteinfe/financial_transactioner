import {
  filterTransactionsByYearMonthRange,
  sectionForCategory,
  type SankeySectionId
} from '@txn/corpus-core/pure'
import type { CorpusTransaction } from '@txn/types'
import { buildSectionModel } from './buildSectionModel.js'
import { verifySectionIntegrity } from './graphIntegrity.js'
import type { SankeyDiagramModel } from './sankeyTypes.js'

function partitionBySection(transactions: CorpusTransaction[]): Record<SankeySectionId, CorpusTransaction[]> {
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

export function buildSankeyDiagramModel(
  yearTransactions: CorpusTransaction[],
  selectedYear: number,
  startMonth: number,
  endMonth: number
): SankeyDiagramModel {
  const filtered = filterTransactionsByYearMonthRange(yearTransactions, selectedYear, startMonth, endMonth)
  const buckets = partitionBySection(filtered)

  const sections = (
    ['main', 'reimbursement', 'transfer'] as const
  ).map((id) => buildSectionModel(id, buckets[id]))

  const integrityErrors: string[] = []
  for (const s of sections) {
    if (!s.hasActivity) continue
    const v = verifySectionIntegrity(s.label, s.nodes, s.links)
    if (!v.ok) integrityErrors.push(...v.errors)
  }

  return {
    selectedYear,
    selectedStartMonth: startMonth,
    selectedEndMonth: endMonth,
    sections,
    integrityErrors
  }
}
