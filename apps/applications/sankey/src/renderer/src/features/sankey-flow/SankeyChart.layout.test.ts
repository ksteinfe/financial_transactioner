import { sankeyLinkHorizontal } from 'd3-sankey'
import { describe, expect, it } from 'vitest'
import type { CorpusTransaction } from '@txn/types'
import { buildSectionModel } from './model/buildSectionModel.js'
import { columnXFraction, dragSankeyNode, layoutSankeySection } from './layoutSankeySection.js'
import {
  flowToHeightPx,
  flowToHeightPxRaw,
  linkVisualHeightPx,
  minFlowDollars
} from './sankeyScale.js'

const TEST_DOLLARS_PER_PX = 100

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

function nodeHeight(n: { y0?: number; y1?: number }): number {
  return (n.y1 ?? 0) - (n.y0 ?? 0)
}

describe('layoutSankeySection link paths', () => {
  it('produces finite horizontal link paths (sankeyLinkHorizontal needs link y0/y1)', () => {
    const section = buildSectionModel('main', [
      tx('income:berkeley', 3000, '1'),
      tx('food:grocery', -400, '2'),
      tx('food:refund', 25, '3'),
      tx('rent:monthly', -1500, '4')
    ])
    const layout = layoutSankeySection(section, 960, TEST_DOLLARS_PER_PX)
    expect(layout).not.toBeNull()
    const path = sankeyLinkHorizontal()

    expect(layout!.links.length).toBeGreaterThan(0)
    for (const link of layout!.links) {
      expect(Number.isFinite(link.y0)).toBe(true)
      expect(Number.isFinite(link.y1)).toBe(true)
      expect(link.width).toBeGreaterThan(0)
      const d = path(link)
      expect(d).toBeTruthy()
      expect(d).not.toContain('NaN')
    }
  })

  it('sizes nodes at base scale (min flow from $/px)', () => {
    const section = buildSectionModel('main', [
      tx('income:berkeley', 3000, '1'),
      tx('food:grocery', -400, '2'),
      tx('rent:monthly', -1500, '3')
    ])
    const layout = layoutSankeySection(section, 960, TEST_DOLLARS_PER_PX)!
    const inflow = layout.nodes.find((n) => n.raw.kind === 'inflow-minor' && n.raw.label.includes('berkeley'))!
    expect(nodeHeight(inflow)).toBeCloseTo(flowToHeightPx(3000, TEST_DOLLARS_PER_PX), 4)

    const grocery = layout.nodes.find((n) => n.raw.kind === 'outflow-minor' && n.raw.label.includes('grocery'))!
    expect(nodeHeight(grocery)).toBeCloseTo(flowToHeightPx(400, TEST_DOLLARS_PER_PX), 4)
    expect(nodeHeight(grocery)).toBeGreaterThanOrEqual(flowToHeightPx(minFlowDollars(TEST_DOLLARS_PER_PX), TEST_DOLLARS_PER_PX))
  })

  it('positions link attach points by real scale (layout width may be below visual min)', () => {
    const section = buildSectionModel('main', [tx('income:berkeley', 1000, '1'), tx('food:grocery', -400, '2')])
    const layout = layoutSankeySection(section, 960, TEST_DOLLARS_PER_PX)!
    const ti = layout.nodes.find((n) => n.raw.kind === 'total-inflow')!
    const span = nodeHeight(ti)
    const outW = ti.sourceLinks.reduce((s, l) => s + l.width, 0)
    expect(outW).toBeLessThanOrEqual(span + 0.01)
    for (const link of ti.sourceLinks) {
      expect(link.y0).toBeGreaterThanOrEqual(ti.y0! - 0.01)
      expect(link.y0).toBeLessThanOrEqual(ti.y1! + 0.01)
    }
  })

  it('clusters sub-minimum flows on real-scale offsets with stroke-sized bands', () => {
    const section = buildSectionModel('main', [
      tx('income:a', 30, '1'),
      tx('income:b', 40, '2'),
      tx('income:c', 50, '3'),
      tx('food:grocery', -120, '4')
    ])
    const layout = layoutSankeySection(section, 960, TEST_DOLLARS_PER_PX)!
    const ti = layout.nodes.find((n) => n.raw.kind === 'total-inflow')!
    const layoutSpan = ti.targetLinks.reduce(
      (s, l) => s + flowToHeightPxRaw(l.value, TEST_DOLLARS_PER_PX),
      0
    )
    expect(layoutSpan).toBeLessThan(nodeHeight(ti))
    for (const link of ti.targetLinks) {
      expect(link.width).toBe(linkVisualHeightPx(link.value, TEST_DOLLARS_PER_PX))
    }
  })

  it('keeps stroke extent inside the node when the visual bundle fits', () => {
    const section = buildSectionModel('main', [
      tx('income:berkeley', 1000, '1'),
      tx('food:grocery', -400, '2')
    ])
    const layout = layoutSankeySection(section, 960, TEST_DOLLARS_PER_PX)!
    const ti = layout.nodes.find((n) => n.raw.kind === 'total-inflow')!
    for (const link of ti.targetLinks) {
      const half = link.width / 2
      expect(link.y1! - half).toBeGreaterThanOrEqual(ti.y0! - 0.01)
      expect(link.y1! + half).toBeLessThanOrEqual(ti.y1! + 0.01)
    }
  })

  it('orders links by neighbor y on each node (incoming and outgoing)', () => {
    const section = buildSectionModel('main', [
      tx('income:a', 1000, '1'),
      tx('income:b', 500, '2'),
      tx('income:c', 200, '3'),
      tx('food:grocery', -400, '4'),
      tx('rent:monthly', -800, '5')
    ])
    const layout = layoutSankeySection(section, 960, TEST_DOLLARS_PER_PX)!
    const ti = layout.nodes.find((n) => n.raw.kind === 'total-inflow')!
    const to = layout.nodes.find((n) => n.raw.kind === 'total-outflow')!

    const sourceYs = ti.targetLinks.map((l) => (l.source.y0! + l.source.y1!) / 2)
    const inAttach = ti.targetLinks.map((l) => l.y1!)
    for (let i = 1; i < sourceYs.length; i++) {
      expect(sourceYs[i]).toBeGreaterThanOrEqual(sourceYs[i - 1] - 0.01)
    }
    for (let i = 1; i < inAttach.length; i++) {
      expect(inAttach[i]).toBeGreaterThanOrEqual(inAttach[i - 1] - 0.01)
    }

    const targetYs = to.sourceLinks.map((l) => (l.target.y0! + l.target.y1!) / 2)
    const outAttach = to.sourceLinks.map((l) => l.y0!)
    for (let i = 1; i < targetYs.length; i++) {
      expect(targetYs[i]).toBeGreaterThanOrEqual(targetYs[i - 1] - 0.01)
    }
    for (let i = 1; i < outAttach.length; i++) {
      expect(outAttach[i]).toBeGreaterThanOrEqual(outAttach[i - 1] - 0.01)
    }
  })

  it('keeps total / deficit / surplus nodes at standard node width', () => {
    const section = buildSectionModel('main', [
      tx('income:berkeley', 3000, '1'),
      tx('food:grocery', -400, '2'),
      tx('rent:monthly', -1500, '3')
    ])
    const layout = layoutSankeySection(section, 960, TEST_DOLLARS_PER_PX)!
    const kinds = ['total-inflow', 'total-outflow', 'deficit', 'surplus'] as const
    const middle = layout.nodes.filter((n) => kinds.includes(n.raw.kind as (typeof kinds)[number]))
    expect(middle.length).toBeGreaterThanOrEqual(2)
    for (const n of middle) {
      const w = (n.x1 ?? 0) - (n.x0 ?? 0)
      expect(w).toBeGreaterThan(12)
      expect(w).toBeLessThan(17)
    }
    const ti = layout.nodes.find((n) => n.raw.kind === 'total-inflow')!
    const def = layout.nodes.find((n) => n.raw.kind === 'deficit')
    if (def) {
      expect(def.x0).toBe(ti.x0)
      expect(def.x1).toBe(ti.x1)
    }
  })

  it('content height fits the tallest column at base scale', () => {
    const section = buildSectionModel('main', [
      tx('income:a', 1000, '1'),
      tx('income:b', 500, '2'),
      tx('income:c', 200, '3'),
      tx('food:grocery', -400, '4')
    ])
    const layout = layoutSankeySection(section, 960, TEST_DOLLARS_PER_PX)!
    const col1 = layout.nodes.filter((n) => n.raw.column === 1)
    const stackH =
      col1.reduce((s, n) => s + nodeHeight(n), 0) + (col1.length - 1) * layout.nodePadding
    expect(layout.contentHeight).toBeGreaterThanOrEqual(stackH + 8)
  })

  it('updates link y0/y1 when a node is dragged', () => {
    const section = buildSectionModel('main', [
      tx('income:berkeley', 3000, '1'),
      tx('food:grocery', -400, '2')
    ])
    const layout = layoutSankeySection(section, 960, TEST_DOLLARS_PER_PX)!
    const inflow = layout.nodes.find((n) => n.raw.kind === 'inflow-minor')
    expect(inflow).toBeDefined()
    const before = layout.links.map((l) => ({ y0: l.y0, y1: l.y1 }))
    dragSankeyNode(layout, inflow!.id, 0, 40)
    const changed = layout.links.some((l, i) => l.y0 !== before[i].y0 || l.y1 !== before[i].y1)
    expect(changed).toBe(true)
    const path = sankeyLinkHorizontal()
    for (const link of layout.links) {
      const d = path(link)
      expect(d).toBeTruthy()
      expect(d).not.toContain('NaN')
    }
  })
})

describe('layoutSankeySection sparse months', () => {
  it('layouts outflow-only month (no inflow column) without throwing', () => {
    const section = buildSectionModel('main', [tx('food:grocery', -50, '1')])
    expect(section.nodes.some((n) => n.kind === 'total-inflow')).toBe(false)
    const layout = layoutSankeySection(section, 960, TEST_DOLLARS_PER_PX)
    expect(layout).not.toBeNull()
    expect(layout!.links.length).toBeGreaterThan(0)
  })

  it('layouts inflow-only month without throwing', () => {
    const section = buildSectionModel('main', [tx('income:berkeley', 200, '1')])
    const layout = layoutSankeySection(section, 960, TEST_DOLLARS_PER_PX)
    expect(layout).not.toBeNull()
  })
})

describe('column spacing', () => {
  it('places columns 2 and 3 one-third the standard gap apart', () => {
    const layout = layoutSankeySection(
      buildSectionModel('main', [
        tx('income:a', 1000, '1'),
        tx('income:b', 500, '2'),
        tx('food:grocery', -400, '3'),
        tx('rent:monthly', -800, '4')
      ]),
      960,
      TEST_DOLLARS_PER_PX
    )!
    const colLeft = (c: number) =>
      Math.min(...layout.nodes.filter((node) => node.raw.column === c).map((node) => node.x0!))
    const edgeGap = (from: number, to: number) => colLeft(to) - colLeft(from)
    const standard = edgeGap(1, 2)
    expect(edgeGap(2, 3)).toBeCloseTo(standard / 3, 4)
    expect(edgeGap(3, 4)).toBeCloseTo(standard, 4)
    expect(columnXFraction(3) - columnXFraction(2)).toBeCloseTo(
      (columnXFraction(2) - columnXFraction(1)) / 3,
      5
    )
  })
})

describe('column alignment across sections', () => {
  it('aligns transfer columns 1–4 with main columns 1–4 on the five-column grid', () => {
    const main = layoutSankeySection(
      buildSectionModel('main', [tx('income:berkeley', 1000, '1'), tx('food:grocery', -400, '2')]),
      960,
      TEST_DOLLARS_PER_PX
    )!
    const xfer = layoutSankeySection(
      buildSectionModel('transfer', [
        tx('transfer:1816_deep', 1000, '1'),
        tx('transfer:2232_bills', -400, '2')
      ]),
      960,
      TEST_DOLLARS_PER_PX
    )!
    for (const col of [1, 2, 3, 4] as const) {
      const mainCol = main.nodes.filter((n) => n.raw.column === col)
      const xferCol = xfer.nodes.filter((n) => n.raw.column === col)
      expect(mainCol.length).toBeGreaterThan(0)
      expect(xferCol.length).toBeGreaterThan(0)
      expect(mainCol[0]!.x0).toBeCloseTo(xferCol[0]!.x0!, 4)
    }
    const mainCol5 = main.nodes.filter((n) => n.raw.column === 5)
    expect(mainCol5.length).toBeGreaterThan(0)
    expect(xfer.nodes.some((n) => n.raw.column === 5)).toBe(false)
  })
})

describe('global scale across sections', () => {
  it('gives the same node height for the same dollar flow in different sections', () => {
    const main = layoutSankeySection(
      buildSectionModel('main', [tx('income:berkeley', 1000, '1'), tx('food:grocery', -400, '2')]),
      960,
      TEST_DOLLARS_PER_PX
    )!
    const xfer = layoutSankeySection(
      buildSectionModel('transfer', [
        tx('transfer:1816_deep', 1000, '1'),
        tx('transfer:2232_bills', -400, '2')
      ]),
      960,
      TEST_DOLLARS_PER_PX
    )!
    const mainIn = main.nodes.find((n) => n.raw.kind === 'inflow-minor')!
    const xferIn = xfer.nodes.find((n) => n.raw.kind === 'inflow-minor')!
    expect(nodeHeight(mainIn)).toBeCloseTo(nodeHeight(xferIn), 4)
    expect(nodeHeight(mainIn)).toBeCloseTo(flowToHeightPx(1000, TEST_DOLLARS_PER_PX), 4)
  })
})
