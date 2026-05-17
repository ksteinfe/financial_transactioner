import { describe, expect, it } from 'vitest'
import type { CorpusTransaction } from '@txn/types'
import { buildSectionModel } from './buildSectionModel.js'
import { resolveNodeTransactions } from './resolveNodeTransactions.js'

function tx(category: string, amount: number, key: string, date = '2025-06-15'): CorpusTransaction {
  return {
    key,
    date,
    amount,
    account: 'a',
    description: 'x',
    category,
    date_created: date,
    date_updated: date
  }
}

describe('resolveNodeTransactions', () => {
  it('returns null for surplus and deficit nodes', () => {
    const surplusSection = buildSectionModel('main', [
      tx('income:berkeley', 3000, '1'),
      tx('food:grocery', -400, '2')
    ])
    const surplus = surplusSection.nodes.find((n) => n.kind === 'surplus')!
    expect(resolveNodeTransactions(surplus, [], 'main')).toBeNull()

    const deficitSection = buildSectionModel('main', [
      tx('income:berkeley', 1000, '1'),
      tx('rent:monthly', -2500, '2')
    ])
    const deficit = deficitSection.nodes.find((n) => n.kind === 'deficit')!
    expect(resolveNodeTransactions(deficit, [], 'main')).toBeNull()
  })

  it('returns all section transactions for total inflow / outflow', () => {
    const txs = [
      tx('income:berkeley', 1000, '1'),
      tx('food:grocery', -400, '2'),
      tx('transfer:6934_checking', 500, '3')
    ]
    const section = buildSectionModel('main', txs)
    const ti = section.nodes.find((n) => n.kind === 'total-inflow')!
    const to = section.nodes.find((n) => n.kind === 'total-outflow')!
    const mainTxs = txs.filter((t) => !t.category.startsWith('transfer:'))
    expect(resolveNodeTransactions(ti, mainTxs, 'main')!.map((t) => t.key)).toEqual(['1', '2'])
    expect(resolveNodeTransactions(to, mainTxs, 'main')!.map((t) => t.key)).toEqual(['1', '2'])
  })

  it('returns all category transactions for main inflow-minor', () => {
    const txs = [
      tx('food:grocery', -400, '1'),
      tx('food:refund', 25, '2'),
      tx('income:berkeley', 3000, '3')
    ]
    const section = buildSectionModel('main', txs)
    const inNode = section.nodes.find((n) => n.kind === 'inflow-minor' && n.category === 'income:berkeley')!
    const resolved = resolveNodeTransactions(inNode, txs, 'main')!
    expect(resolved).toHaveLength(1)
    expect(resolved[0].key).toBe('3')
  })

  it('returns all category transactions for main outflow-minor (including mixed signs)', () => {
    const txs = [
      tx('food:grocery', -400, '1'),
      tx('food:grocery', 100, '2')
    ]
    const section = buildSectionModel('main', txs)
    const outNode = section.nodes.find((n) => n.kind === 'outflow-minor' && n.category === 'food:grocery')!
    const resolved = resolveNodeTransactions(outNode, txs, 'main')!
    expect(resolved.map((t) => t.key).sort()).toEqual(['1', '2'])
  })

  it('filters by sign for transfer inflow / outflow minors', () => {
    const txs = [
      tx('transfer:6934_checking', 500, '1'),
      tx('transfer:6934_checking', -200, '2'),
      tx('transfer:6934_checking', 100, '3')
    ]
    const section = buildSectionModel('transfer', txs)
    const inNode = section.nodes.find((n) => n.kind === 'inflow-minor')!
    const outNode = section.nodes.find((n) => n.kind === 'outflow-minor')!
    expect(resolveNodeTransactions(inNode, txs, 'transfer')!.map((t) => t.key).sort()).toEqual(['1', '3'])
    expect(resolveNodeTransactions(outNode, txs, 'transfer')!.map((t) => t.key)).toEqual(['2'])
  })

  it('returns transactions in outflow categories for outflow-major', () => {
    const txs = [
      tx('income:berkeley', 3000, '1'),
      tx('food:grocery', -400, '2'),
      tx('food:refund', 25, '3'),
      tx('rent:monthly', -1500, '4')
    ]
    const section = buildSectionModel('main', txs)
    const foodMajor = section.nodes.find((n) => n.kind === 'outflow-major' && n.label === 'food')!
    const resolved = resolveNodeTransactions(foodMajor, txs, 'main')!
    expect(resolved.map((t) => t.key)).toEqual(['2'])
  })

  it('sorts by date then key', () => {
    const txs = [
      tx('income:berkeley', 100, 'b', '2025-03-01'),
      tx('income:berkeley', 200, 'a', '2025-01-01'),
      tx('income:berkeley', 300, 'c', '2025-03-01')
    ]
    const section = buildSectionModel('main', txs)
    const inNode = section.nodes.find((n) => n.kind === 'inflow-minor')!
    expect(resolveNodeTransactions(inNode, txs, 'main')!.map((t) => t.key)).toEqual(['a', 'b', 'c'])
  })
})
