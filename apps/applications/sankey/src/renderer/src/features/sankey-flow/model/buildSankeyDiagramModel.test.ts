import { describe, expect, it } from 'vitest'
import type { CorpusTransaction } from '@txn/types'
import { buildSankeyDiagramModel } from './buildSankeyDiagramModel.js'

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
  })
})
