/** Categories routed to the reimbursement Sankey section (exact corpus strings). */
export const REIMBURSEMENT_CATEGORIES = new Set<string>([
  'reimbursment:berkeley',
  'reimbursment:som',
  'reimbursment:other'
])

/** Categories routed to the transfer Sankey section (exact corpus strings). */
export const TRANSFER_CATEGORIES = new Set<string>([
  'transfer:1816_deep',
  'transfer:2232_bills',
  'transfer:3570_project',
  'transfer:credit_card_payment',
  'unknown:unaccounted_transfer'
])

export type SankeySectionId = 'main' | 'reimbursement' | 'transfer'

export function sectionForCategory(category: string): SankeySectionId {
  if (REIMBURSEMENT_CATEGORIES.has(category)) return 'reimbursement'
  if (TRANSFER_CATEGORIES.has(category)) return 'transfer'
  return 'main'
}
