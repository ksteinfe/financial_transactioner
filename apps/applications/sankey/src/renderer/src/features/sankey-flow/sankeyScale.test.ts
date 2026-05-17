import { describe, expect, it } from 'vitest'
import type { CorpusTransaction } from '@txn/types'
import { buildSectionModel } from './model/buildSectionModel.js'
import {
  flowToHeightPx,
  formatDollarsPerPixel,
  maxLabelFontSizePx,
  measureSankeyDiagramHeight,
  minFlowDollars,
  nodeLabelFontSizePx,
  pickAutoDollarsPerPixel,
  SANKEY_DOLLARS_PER_PX_STEPS,
  SANKEY_LABEL_FONT_MAX_PX,
  SANKEY_LABEL_FONT_MIN_PX,
  SANKEY_MIN_NODE_HEIGHT_PX,
  SANKEY_TARGET_HEIGHT_MAX,
  SANKEY_TARGET_HEIGHT_MIN,
  stepDollarsPerPixel
} from './sankeyScale.js'

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

describe('pickAutoDollarsPerPixel', () => {
  it('only returns an allowed scale step', () => {
    const section = buildSectionModel('main', [
      tx('income:berkeley', 3000, '1'),
      tx('food:grocery', -400, '2'),
      tx('rent:monthly', -1500, '3')
    ])
    const dpp = pickAutoDollarsPerPixel([section], 960)
    expect(SANKEY_DOLLARS_PER_PX_STEPS).toContain(dpp)
  })

  it('returns a step that fits the target height band when possible', () => {
    const section = buildSectionModel('main', [
      tx('income:berkeley', 3000, '1'),
      tx('food:grocery', -400, '2'),
      tx('rent:monthly', -1500, '3')
    ])
    const dpp = pickAutoDollarsPerPixel([section], 960)
    const h = measureSankeyDiagramHeight([section], 960, dpp)
    expect(h).toBeLessThanOrEqual(SANKEY_TARGET_HEIGHT_MAX)
    expect(SANKEY_DOLLARS_PER_PX_STEPS).toContain(dpp)
  })

  it('chooses the step nearest the band midpoint among scales that fit', () => {
    const section = buildSectionModel('main', [
      tx('income:berkeley', 6000, '1'),
      tx('food:grocery', -2000, '2'),
      tx('rent:monthly', -2500, '3')
    ])
    const targetHeight = (SANKEY_TARGET_HEIGHT_MIN + SANKEY_TARGET_HEIGHT_MAX) / 2
    const scored = SANKEY_DOLLARS_PER_PX_STEPS.map((s) => ({
      s,
      h: measureSankeyDiagramHeight([section], 960, s, 8, true)
    }))
    const fitsMax = scored.filter((x) => x.h <= SANKEY_TARGET_HEIGHT_MAX)
    const inRange = fitsMax.filter((x) => x.h >= SANKEY_TARGET_HEIGHT_MIN)
    const pool = inRange.length > 0 ? inRange : fitsMax
    const expected = pool.reduce((best, x) => {
      const dBest = Math.abs(best.h - targetHeight)
      const dX = Math.abs(x.h - targetHeight)
      if (dX < dBest) return x
      if (dX > dBest) return best
      return x.s < best.s ? x : best
    }).s
    expect(pickAutoDollarsPerPixel([section], 960)).toBe(expected)
  })
})

describe('dollars per pixel scale', () => {
  it('exposes the constrained scale steps', () => {
    expect(SANKEY_DOLLARS_PER_PX_STEPS).toEqual([100, 500, 1000, 5000])
  })

  it('formats base scale as $/px', () => {
    expect(formatDollarsPerPixel(100)).toBe('$100/px')
    expect(formatDollarsPerPixel(5000)).toBe('$5,000/px')
  })

  it('derives min flow so the smallest band is ~2px at each step', () => {
    for (const dpp of SANKEY_DOLLARS_PER_PX_STEPS) {
      expect(minFlowDollars(dpp)).toBe(SANKEY_MIN_NODE_HEIGHT_PX * dpp)
      expect(flowToHeightPx(dpp / 2, dpp)).toBeCloseTo(SANKEY_MIN_NODE_HEIGHT_PX, 4)
    }
    expect(flowToHeightPx(10_000, 100)).toBeCloseTo(100, 4)
  })

  it('maps toolbar steps finer/coarser within the allowed range', () => {
    expect(stepDollarsPerPixel(100, 1)).toBe(500)
    expect(stepDollarsPerPixel(5000, -1)).toBe(1000)
    expect(flowToHeightPx(3000, 100)).toBeGreaterThan(flowToHeightPx(3000, 5000))
  })
})

describe('node label font size', () => {
  it('caps max font by $/px (finest allows max px, coarsest allows min px)', () => {
    expect(maxLabelFontSizePx(100)).toBe(SANKEY_LABEL_FONT_MAX_PX)
    expect(maxLabelFontSizePx(5000)).toBe(SANKEY_LABEL_FONT_MIN_PX)
    expect(maxLabelFontSizePx(1000)).toBeGreaterThan(SANKEY_LABEL_FONT_MIN_PX)
    expect(maxLabelFontSizePx(1000)).toBeLessThan(SANKEY_LABEL_FONT_MAX_PX)
  })

  it('never goes below the minimum font size', () => {
    expect(nodeLabelFontSizePx(2, 5000)).toBe(SANKEY_LABEL_FONT_MIN_PX)
  })

  it('grows with node height but not above the scale max', () => {
    const tall = nodeLabelFontSizePx(400, 100)
    const short = nodeLabelFontSizePx(4, 100)
    expect(tall).toBeGreaterThan(short)
    expect(tall).toBeLessThanOrEqual(maxLabelFontSizePx(100))
    expect(nodeLabelFontSizePx(10_000, 5000)).toBe(SANKEY_LABEL_FONT_MIN_PX)
  })
})
