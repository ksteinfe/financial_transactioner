export type SankeySectionId = 'main' | 'reimbursement' | 'transfer'

const REIMBURSEMENT_PREFIXES = ['reimbursement:', 'reimbursment:'] as const

/** `reimbursement:*` (corpus); legacy `reimbursment:*` still routes here. */
export function isReimbursementCategory(category: string): boolean {
  return REIMBURSEMENT_PREFIXES.some((p) => category.startsWith(p))
}

export function isTransferCategory(category: string): boolean {
  return category.startsWith('transfer:') || category === 'unknown:unaccounted_transfer'
}

export function sectionForCategory(category: string): SankeySectionId {
  if (isReimbursementCategory(category)) return 'reimbursement'
  if (isTransferCategory(category)) return 'transfer'
  return 'main'
}
