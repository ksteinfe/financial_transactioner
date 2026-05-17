import type { SankeySectionId, SankeySectionModel } from './model/sankeyTypes.js'
import { formatCurrencyShort } from './model/formatCurrencyShort.js'

const BALANCE_EPSILON = 0.005

export function isCollapsibleSection(sectionId: SankeySectionId): boolean {
  return sectionId === 'transfer' || sectionId === 'reimbursement'
}

export function isSectionBalanced(section: SankeySectionModel): boolean {
  return section.deficit <= BALANCE_EPSILON && section.surplus <= BALANCE_EPSILON
}

/** Compact amount for titles, e.g. `5k` (no dollar sign). */
export function formatCompactAmount(value: number): string {
  return formatCurrencyShort(Math.abs(value)).replace(/^\$/, '')
}

export function formatCollapsibleSectionTitle(section: SankeySectionModel): string {
  if (section.surplus > BALANCE_EPSILON) {
    return `${section.label} (${formatCurrencyShort(section.surplus)} surplus)`
  }
  if (section.deficit > BALANCE_EPSILON) {
    return `${section.label} (${formatCompactAmount(section.deficit)} deficit)`
  }
  return `${section.label} (balanced)`
}

export function defaultSectionExpanded(section: SankeySectionModel): boolean {
  if (!isCollapsibleSection(section.id)) return true
  return !isSectionBalanced(section)
}

export function buildInitialExpandedById(
  sections: SankeySectionModel[]
): Partial<Record<SankeySectionId, boolean>> {
  const out: Partial<Record<SankeySectionId, boolean>> = {}
  for (const s of sections) {
    if (isCollapsibleSection(s.id)) {
      out[s.id] = defaultSectionExpanded(s)
    }
  }
  return out
}
