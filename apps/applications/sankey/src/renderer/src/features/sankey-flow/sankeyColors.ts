import { getColorForCategory, getColorForMajor } from '@txn/category-colors'
import type { SankeyNodeModel } from './model/sankeyTypes.js'

/**
 * Resolve fill for a Sankey node: category-colors for category/major rows; CSS semantic vars for totals/surplus/deficit.
 */
export function getSankeyNodeFill(node: SankeyNodeModel): string {
  const k = node.kind
  if (k === 'deficit') return 'var(--sankey-deficit, #ff0000)'
  if (k === 'surplus') return 'var(--sankey-surplus, #00dd44)'
  if (k === 'total-inflow' || k === 'total-outflow') return 'var(--sankey-total, #889)'
  if (node.category && (k === 'inflow-minor' || k === 'outflow-minor')) {
    return getColorForCategory(node.category).hex
  }
  if (node.majorCategory && k === 'outflow-major') {
    return getColorForMajor(node.majorCategory).hex
  }
  return 'var(--sankey-neutral, #666)'
}
