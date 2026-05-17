import { parseCategory } from '@txn/corpus-core/pure'
import type { CorpusTransaction } from '@txn/types'
import { collectInflowOutflow } from './buildSectionModel.js'
import type { SankeyNodeModel, SankeySectionId } from './sankeyTypes.js'

function sortTransactions(rows: CorpusTransaction[]): CorpusTransaction[] {
  return [...rows].sort((a, b) => {
    const d = a.date.localeCompare(b.date)
    if (d !== 0) return d
    return a.key.localeCompare(b.key)
  })
}

function outflowCategorySet(sectionId: SankeySectionId, sectionTransactions: CorpusTransaction[]): Set<string> {
  const flow = collectInflowOutflow(sectionId, sectionTransactions)
  if (!flow) return new Set()
  return new Set(flow.outflowCats.map((a) => a.category))
}

/**
 * Returns transactions backing a Sankey node, or null when the node should not open a drill-down.
 */
export function resolveNodeTransactions(
  node: SankeyNodeModel,
  sectionTransactions: CorpusTransaction[],
  sectionId: SankeySectionId
): CorpusTransaction[] | null {
  const kind = node.kind

  if (kind === 'surplus' || kind === 'deficit') return null

  if (kind === 'total-inflow' || kind === 'total-outflow') {
    return sortTransactions(sectionTransactions)
  }

  if (kind === 'inflow-minor') {
    if (!node.category) return []
    if (sectionId === 'main') {
      return sortTransactions(sectionTransactions.filter((tx) => tx.category === node.category))
    }
    return sortTransactions(
      sectionTransactions.filter((tx) => tx.category === node.category && tx.amount > 0)
    )
  }

  if (kind === 'outflow-minor') {
    if (!node.category) return []
    if (sectionId === 'main') {
      return sortTransactions(sectionTransactions.filter((tx) => tx.category === node.category))
    }
    return sortTransactions(
      sectionTransactions.filter((tx) => tx.category === node.category && tx.amount < 0)
    )
  }

  if (kind === 'outflow-major') {
    const major = node.majorCategory ?? node.label
    const outflowCats = outflowCategorySet(sectionId, sectionTransactions)
    return sortTransactions(
      sectionTransactions.filter((tx) => {
        if (parseCategory(tx.category).major !== major) return false
        return outflowCats.has(tx.category)
      })
    )
  }

  return []
}
