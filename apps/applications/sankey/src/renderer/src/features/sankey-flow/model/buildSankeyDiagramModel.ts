import { filterTransactionsByYearMonthRange } from '@txn/corpus-core/pure'
import type { CorpusTransaction } from '@txn/types'
import { buildSectionModel } from './buildSectionModel.js'
import { verifySectionIntegrity } from './graphIntegrity.js'
import { partitionBySection } from './partitionBySection.js'
import { SANKEY_SECTION_DISPLAY_ORDER, type SankeyDiagramModel } from './sankeyTypes.js'

export function buildSankeyDiagramModel(
  yearTransactions: CorpusTransaction[],
  selectedYear: number,
  startMonth: number,
  endMonth: number
): SankeyDiagramModel {
  const filtered = filterTransactionsByYearMonthRange(yearTransactions, selectedYear, startMonth, endMonth)
  const buckets = partitionBySection(filtered)

  const sections = SANKEY_SECTION_DISPLAY_ORDER.map((id) => buildSectionModel(id, buckets[id]))

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
