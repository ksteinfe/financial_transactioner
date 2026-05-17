import { describe, expect, it } from 'vitest'
import type { SankeySectionModel } from './model/sankeyTypes.js'
import {
  buildInitialExpandedById,
  defaultSectionExpanded,
  formatCollapsibleSectionTitle,
  isSectionBalanced
} from './sectionTitle.js'

function section(
  id: SankeySectionModel['id'],
  surplus: number,
  deficit: number
): SankeySectionModel {
  return {
    id,
    label: id === 'transfer' ? 'Transfer' : 'Reimbursement',
    nodes: [],
    links: [],
    totalInflow: 0,
    totalOutflow: 0,
    surplus,
    deficit,
    hasActivity: true
  }
}

describe('sectionTitle', () => {
  it('formats balanced, surplus, and deficit titles', () => {
    expect(formatCollapsibleSectionTitle(section('transfer', 0, 0))).toBe('Transfer (balanced)')
    expect(formatCollapsibleSectionTitle(section('transfer', 5000, 0))).toBe('Transfer ($5k surplus)')
    expect(formatCollapsibleSectionTitle(section('transfer', 0, 1200))).toBe('Transfer (1.2k deficit)')
  })

  it('defaults collapsible sections to collapsed when balanced', () => {
    expect(defaultSectionExpanded(section('transfer', 0, 0))).toBe(false)
    expect(defaultSectionExpanded(section('transfer', 100, 0))).toBe(true)
    expect(buildInitialExpandedById([section('transfer', 0, 0), section('reimbursement', 50, 0)])).toEqual({
      transfer: false,
      reimbursement: true
    })
  })

  it('detects balance within epsilon', () => {
    expect(isSectionBalanced(section('transfer', 0.001, 0))).toBe(true)
    expect(isSectionBalanced(section('transfer', 1, 0))).toBe(false)
  })
})
