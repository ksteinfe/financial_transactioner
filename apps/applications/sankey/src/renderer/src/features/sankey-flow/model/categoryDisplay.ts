import { parseCategory } from '@txn/corpus-core/pure'
import type { SankeyNodeKind, SankeySectionId } from './sankeyTypes.js'

/** Minor segment only (`food:grocery` → `grocery`). */
export function minorCategoryDisplayName(category: string): string {
  return parseCategory(category).minor
}

export function displayLabelForCategoryNode(
  sectionId: SankeySectionId,
  kind: SankeyNodeKind,
  column: 1 | 2 | 3 | 4 | 5,
  category: string
): string {
  const stripTransferReimb =
    (sectionId === 'transfer' || sectionId === 'reimbursement') &&
    (kind === 'inflow-minor' || kind === 'outflow-minor')
  const stripMainCol5 = sectionId === 'main' && kind === 'outflow-minor' && column === 5
  if (stripTransferReimb || stripMainCol5) {
    return minorCategoryDisplayName(category)
  }
  return category
}
