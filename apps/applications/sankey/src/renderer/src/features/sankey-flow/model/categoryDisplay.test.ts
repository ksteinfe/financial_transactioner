import { describe, expect, it } from 'vitest'
import type { CorpusTransaction } from '@txn/types'
import { layoutSankeySection } from '../layoutSankeySection.js'
import { displayLabelForCategoryNode, minorCategoryDisplayName } from './categoryDisplay.js'
import { buildSectionModel } from './buildSectionModel.js'

function tx(category: string, amount: number, key: string): CorpusTransaction {
  const d = '2025-06-15'
  return {
    key,
    date: d,
    amount,
    account: 'a',
    description: 'x',
    category,
    date_created: d,
    date_updated: d
  }
}

describe('categoryDisplay', () => {
  it('extracts minor name from category path', () => {
    expect(minorCategoryDisplayName('food:grocery')).toBe('grocery')
  })

  it('strips major for transfer/reimbursement category nodes', () => {
    expect(displayLabelForCategoryNode('transfer', 'inflow-minor', 1, 'transfer:1816_deep')).toBe(
      '1816_deep'
    )
    expect(displayLabelForCategoryNode('reimbursement', 'outflow-minor', 4, 'reimbursement:som')).toBe(
      'som'
    )
    expect(displayLabelForCategoryNode('main', 'inflow-minor', 1, 'income:berkeley')).toBe(
      'income:berkeley'
    )
    expect(displayLabelForCategoryNode('main', 'outflow-minor', 5, 'food:grocery')).toBe('grocery')
  })
})

describe('buildSectionModel main column 5', () => {
  it('orders minors by column-4 major order then by magnitude', () => {
    const section = buildSectionModel('main', [
      tx('food:grocery', -400, '1'),
      tx('food:restaurant', -100, '2'),
      tx('rent:monthly', -1500, '3')
    ])
    const majors = section.nodes.filter((n) => n.kind === 'outflow-major')
    const minors = section.nodes.filter((n) => n.kind === 'outflow-minor')
    expect(majors.map((m) => m.label)).toEqual(['rent', 'food'])
    expect(minors.map((m) => m.displayLabel)).toEqual(['monthly', 'grocery', 'restaurant'])
    expect(minors.map((m) => m.stackOrder)).toEqual([0, 1, 2])
  })

  it('lays out column 5 top-to-bottom in stackOrder (column 4 major order)', () => {
    const section = buildSectionModel('main', [
      tx('food:grocery', -400, '1'),
      tx('food:restaurant', -100, '2'),
      tx('rent:monthly', -1500, '3')
    ])
    const layout = layoutSankeySection(section, 960, 100)!
    const minors = layout.nodes
      .filter((n) => n.raw.column === 5)
      .sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0))
    expect(minors.map((n) => n.raw.displayLabel)).toEqual(['monthly', 'grocery', 'restaurant'])
  })
})
