import { describe, expect, it } from 'vitest'
import { sectionForCategory } from '@txn/corpus-core/pure'
import type { CorpusTransaction } from '@txn/types'
import { buildSankeyDiagramModel } from './buildSankeyDiagramModel.js'
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

describe('sectionForCategory', () => {
  it('routes transfer:* and unknown:unaccounted_transfer to transfer', () => {
    expect(sectionForCategory('transfer:6934_checking')).toBe('transfer')
    expect(sectionForCategory('transfer:1816_deep')).toBe('transfer')
    expect(sectionForCategory('unknown:unaccounted_transfer')).toBe('transfer')
  })

  it('routes reimbursement:* to reimbursement', () => {
    expect(sectionForCategory('reimbursement:berkeley')).toBe('reimbursement')
    expect(sectionForCategory('reimbursement:som')).toBe('reimbursement')
    expect(sectionForCategory('reimbursement:other')).toBe('reimbursement')
  })

  it('still routes legacy reimbursment:* to reimbursement', () => {
    expect(sectionForCategory('reimbursment:berkeley')).toBe('reimbursement')
  })

  it('routes other categories to main', () => {
    expect(sectionForCategory('income:berkeley')).toBe('main')
    expect(sectionForCategory('food:grocery')).toBe('main')
  })
})

describe('buildSankeyDiagramModel (spec example)', () => {
  it('computes main section inflow, outflow, surplus, majors', () => {
    const yearTx: CorpusTransaction[] = [
      tx('income:berkeley', 3000, '1'),
      tx('food:grocery', -400, '2'),
      tx('food:refund', 25, '3'),
      tx('rent:monthly', -1500, '4')
    ]
    const model = buildSankeyDiagramModel(yearTx, 2025, 1, 12)
    const main = model.sections.find((s) => s.id === 'main')
    expect(main).toBeDefined()
    expect(main!.totalInflow).toBeCloseTo(3025, 5)
    expect(main!.totalOutflow).toBeCloseTo(1900, 5)
    expect(main!.surplus).toBeCloseTo(1125, 5)
    expect(main!.deficit).toBe(0)
    const majors = main!.nodes.filter((n) => n.kind === 'outflow-major')
    const food = majors.find((m) => m.label === 'food')
    const rent = majors.find((m) => m.label === 'rent')
    expect(food?.magnitude).toBeCloseTo(400, 5)
    expect(rent?.magnitude).toBeCloseTo(1500, 5)
    expect(model.integrityErrors.length).toBe(0)
    const bridge = main!.links.find((l) => l.id.endsWith('|link|bridge'))
    expect(bridge?.value).toBeCloseTo(1900, 5)
    const surplusLink = main!.links.find((l) => l.id.endsWith('|link|surplus'))
    expect(surplusLink?.source).toBe('main|total-inflow')
    expect(surplusLink?.value).toBeCloseTo(1125, 5)
  })

  it('routes deficit to total outflow without inflating total inflow node', () => {
    const yearTx: CorpusTransaction[] = [
      tx('income:berkeley', 1000, '1'),
      tx('rent:monthly', -2500, '2')
    ]
    const model = buildSankeyDiagramModel(yearTx, 2025, 1, 12)
    const main = model.sections.find((s) => s.id === 'main')!
    expect(main.deficit).toBeCloseTo(1500, 5)
    expect(main.surplus).toBe(0)
    const ti = main.nodes.find((n) => n.kind === 'total-inflow')!
    const to = main.nodes.find((n) => n.kind === 'total-outflow')!
    expect(ti.magnitude).toBeCloseTo(1000, 5)
    expect(to.magnitude).toBeCloseTo(2500, 5)
    const deficitLink = main.links.find((l) => l.id.endsWith('|link|deficit'))
    expect(deficitLink?.target).toBe('main|total-outflow')
    expect(deficitLink?.value).toBeCloseTo(1500, 5)
    expect(model.integrityErrors.length).toBe(0)
  })

  it('omits total inflow / outflow nodes when the corresponding total is zero', () => {
    const yearTx: CorpusTransaction[] = [tx('food:grocery', -50, '1')]
    const model = buildSankeyDiagramModel(yearTx, 2025, 1, 12)
    const main = model.sections.find((s) => s.id === 'main')!
    expect(main.totalInflow).toBe(0)
    expect(main.totalOutflow).toBeCloseTo(50, 5)
    expect(main.nodes.some((n) => n.kind === 'total-inflow')).toBe(false)
    expect(main.nodes.some((n) => n.kind === 'total-outflow')).toBe(true)
    expect(model.integrityErrors.length).toBe(0)
  })

  it('partitions transfer:* into the transfer section', () => {
    const yearTx: CorpusTransaction[] = [
      tx('income:berkeley', 1000, '1'),
      tx('transfer:6934_checking', 500, '2'),
      tx('transfer:6934_checking', -200, '3')
    ]
    const model = buildSankeyDiagramModel(yearTx, 2025, 1, 12)
    const main = model.sections.find((s) => s.id === 'main')!
    const xfer = model.sections.find((s) => s.id === 'transfer')!
    expect(main.totalInflow).toBeCloseTo(1000, 5)
    expect(xfer.totalInflow).toBeCloseTo(500, 5)
    expect(xfer.totalOutflow).toBeCloseTo(200, 5)
    expect(xfer.nodes.some((n) => n.kind === 'outflow-major')).toBe(false)
    const inNode = xfer.nodes.find((n) => n.kind === 'inflow-minor' && n.category === 'transfer:6934_checking')
    const outNode = xfer.nodes.find((n) => n.kind === 'outflow-minor' && n.category === 'transfer:6934_checking')
    expect(inNode?.magnitude).toBeCloseTo(500, 5)
    expect(outNode?.magnitude).toBeCloseTo(200, 5)
    expect(inNode?.column).toBe(1)
    expect(outNode?.column).toBe(4)
  })
})

describe('buildSectionModel split-sign (reimbursement / transfer)', () => {
  it('keeps positive and negative totals separate for the same category', () => {
    const section = buildSectionModel('transfer', [
      tx('transfer:1816_deep', 1000, '1'),
      tx('transfer:1816_deep', -400, '2'),
      tx('transfer:1816_deep', 100, '3')
    ])
    expect(section.totalInflow).toBeCloseTo(1100, 5)
    expect(section.totalOutflow).toBeCloseTo(400, 5)
    const inNode = section.nodes.find((n) => n.kind === 'inflow-minor' && n.category === 'transfer:1816_deep')
    const outNode = section.nodes.find((n) => n.kind === 'outflow-minor' && n.category === 'transfer:1816_deep')
    expect(inNode?.magnitude).toBeCloseTo(1100, 5)
    expect(outNode?.magnitude).toBeCloseTo(400, 5)
  })

  it('stacks sections main, then transfer, then reimbursement', () => {
    const yearTx: CorpusTransaction[] = [
      tx('income:berkeley', 100, '1'),
      tx('transfer:1816_deep', 200, '2'),
      tx('reimbursement:berkeley', 50, '3')
    ]
    const model = buildSankeyDiagramModel(yearTx, 2025, 1, 12)
    const active = model.sections.filter((s) => s.hasActivity).map((s) => s.id)
    expect(active).toEqual(['main', 'transfer', 'reimbursement'])
  })

  it('nets positives and negatives in main', () => {
    const section = buildSectionModel('main', [
      tx('food:grocery', -400, '1'),
      tx('food:grocery', 100, '2')
    ])
    expect(section.nodes.some((n) => n.kind === 'inflow-minor' && n.category === 'food:grocery')).toBe(false)
    const outNode = section.nodes.find((n) => n.kind === 'outflow-minor' && n.category === 'food:grocery')
    expect(outNode?.magnitude).toBeCloseTo(300, 5)
  })
})
