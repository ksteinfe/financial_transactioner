import type { SankeyNodeKind, SankeySectionModel } from './model/sankeyTypes.js'

/** Minimum node band height in pixels (~2px at every scale step). */
export const SANKEY_MIN_NODE_HEIGHT_PX = 2

/** Allowable base scale ($ per pixel), fine → coarse. */
export const SANKEY_DOLLARS_PER_PX_STEPS: readonly number[] = [100, 500, 1000, 5000]

export const SANKEY_SECTION_TITLE_H = 28
export const SANKEY_SECTION_GAP = 24
export const SANKEY_EMPTY_CHART_H = 120
const EXTENT_MARGIN = 4

export const SANKEY_TARGET_HEIGHT_MIN = 480
export const SANKEY_TARGET_HEIGHT_MAX = 1400

/** Smallest flow ($) drawn tall enough to reach {@link SANKEY_MIN_NODE_HEIGHT_PX}. */
export function minFlowDollars(dollarsPerPixel: number): number {
  return SANKEY_MIN_NODE_HEIGHT_PX * dollarsPerPixel
}

/** Proportional height without a per-item floor (for auto-scale measurement). */
export function flowToHeightPxRaw(dollars: number, dollarsPerPixel: number): number {
  if (dollarsPerPixel <= 0) return 0
  return dollars / dollarsPerPixel
}

/** Node height at base scale; small totals get a minimum band height. */
export function flowToHeightPx(dollars: number, dollarsPerPixel: number): number {
  return Math.max(minFlowDollars(dollarsPerPixel), dollars) / dollarsPerPixel
}

/** Node label font floor in SVG px (screen space, not zoomed). */
export const SANKEY_LABEL_FONT_MIN_PX = 12

/** Node label font ceiling at the finest $/px step. */
export const SANKEY_LABEL_FONT_MAX_PX = 18

/**
 * Largest label size allowed at this $/px — finer scales allow larger type;
 * coarsest step caps at {@link SANKEY_LABEL_FONT_MIN_PX}.
 */
export function maxLabelFontSizePx(dollarsPerPixel: number): number {
  const steps = SANKEY_DOLLARS_PER_PX_STEPS
  const finest = steps[0]!
  const coarsest = steps[steps.length - 1]!
  if (steps.length <= 1 || finest >= coarsest) {
    return SANKEY_LABEL_FONT_MAX_PX
  }
  const clamped = Math.min(coarsest, Math.max(finest, dollarsPerPixel))
  const t = (Math.log(clamped) - Math.log(finest)) / (Math.log(coarsest) - Math.log(finest))
  return SANKEY_LABEL_FONT_MAX_PX - t * (SANKEY_LABEL_FONT_MAX_PX - SANKEY_LABEL_FONT_MIN_PX)
}

/** Label font size from node band height, capped by the current $/px scale. */
export function nodeLabelFontSizePx(nodeHeightPx: number, dollarsPerPixel: number): number {
  const maxFs = maxLabelFontSizePx(dollarsPerPixel)
  const scaled = Math.sqrt(Math.max(0, nodeHeightPx)) * 2.2
  return Math.min(maxFs, Math.max(SANKEY_LABEL_FONT_MIN_PX, scaled))
}

/** Stroke thickness; attach points use real-scale offsets with this half-width centered on y0/y1. */
export function linkVisualHeightPx(dollars: number, dollarsPerPixel: number): number {
  return Math.max(SANKEY_MIN_NODE_HEIGHT_PX, flowToHeightPxRaw(dollars, dollarsPerPixel))
}

const KIND_STACK_RANK: Partial<Record<SankeyNodeKind, number>> = {
  'total-inflow': 0,
  deficit: 1,
  'total-outflow': 0,
  surplus: 1
}

function stackRank(kind: SankeyNodeKind): number {
  return KIND_STACK_RANK[kind] ?? 100
}

function sankeyNodeSort(
  a: { raw: SankeySectionModel['nodes'][0] },
  b: { raw: SankeySectionModel['nodes'][0] }
): number {
  const col = a.raw.column - b.raw.column
  if (col !== 0) return col
  const d = stackRank(a.raw.kind) - stackRank(b.raw.kind)
  if (d !== 0) return d
  const dv = b.raw.sortValue - a.raw.sortValue
  if (dv !== 0) return dv
  return a.raw.label.localeCompare(b.raw.label)
}

type LinkDatum = { source: number; target: number; value: number }

function assignNodeValues(
  nodes: { raw: SankeySectionModel['nodes'][0]; value?: number }[],
  linkData: LinkDatum[]
): void {
  const incoming = new Array<number>(nodes.length).fill(0)
  const outgoing = new Array<number>(nodes.length).fill(0)
  for (const l of linkData) {
    outgoing[l.source] += l.value
    incoming[l.target] += l.value
  }
  for (let i = 0; i < nodes.length; i += 1) {
    nodes[i]!.value = Math.max(incoming[i]!, outgoing[i]!)
  }
}

export function measureSankeySectionHeight(
  section: SankeySectionModel,
  nodePadding: number,
  dollarsPerPixel: number,
  forAutoScale = false
): number {
  const toPx = forAutoScale ? flowToHeightPxRaw : flowToHeightPx
  if (!section.hasActivity || section.nodes.length === 0) return 0

  const idToIndex = new Map<string, number>()
  section.nodes.forEach((n, i) => idToIndex.set(n.id, i))
  const nodes = section.nodes.map((n) => ({ id: n.id, raw: n, value: 0 }))
  const linkData = section.links
    .map((l) => {
      const s = idToIndex.get(l.source)
      const t = idToIndex.get(l.target)
      if (s === undefined || t === undefined) return null
      return { source: s, target: t, value: l.value }
    })
    .filter((x): x is LinkDatum => x !== null)

  assignNodeValues(nodes, linkData)

  const byCol = new Map<number, typeof nodes>()
  for (const n of nodes) {
    if (!byCol.has(n.raw.column)) byCol.set(n.raw.column, [])
    byCol.get(n.raw.column)!.push(n)
  }

  let maxCol = 0
  for (const colNodes of byCol.values()) {
    colNodes.sort(sankeyNodeSort)
    let colH = 0
    for (let i = 0; i < colNodes.length; i += 1) {
      colH += toPx(colNodes[i]!.value ?? 0, dollarsPerPixel)
      if (i < colNodes.length - 1) colH += nodePadding
    }
    maxCol = Math.max(maxCol, colH)
  }

  return maxCol + EXTENT_MARGIN * 2
}

export function measureSankeyDiagramHeight(
  sections: SankeySectionModel[],
  width: number,
  dollarsPerPixel: number,
  nodePadding = 8,
  forAutoScale = false
): number {
  const active = sections.filter((s) => s.hasActivity)
  if (active.length === 0) return SANKEY_EMPTY_CHART_H

  let total = 0
  for (const section of active) {
    total +=
      SANKEY_SECTION_TITLE_H +
      measureSankeySectionHeight(section, nodePadding, dollarsPerPixel, forAutoScale) +
      SANKEY_SECTION_GAP
  }
  return total - SANKEY_SECTION_GAP
}

/**
 * Pick $/px so measured height lands near the middle of [targetMin, targetMax].
 * Balances the old coarse-biased pick with always choosing the tallest fit.
 */
export function pickAutoDollarsPerPixel(
  sections: SankeySectionModel[],
  width: number,
  targetMin = SANKEY_TARGET_HEIGHT_MIN,
  targetMax = SANKEY_TARGET_HEIGHT_MAX
): number {
  const targetHeight = (targetMin + targetMax) / 2
  const scored = SANKEY_DOLLARS_PER_PX_STEPS.map((s) => ({
    s,
    h: measureSankeyDiagramHeight(sections, width, s, 8, true)
  }))
  const fitsMax = scored.filter((x) => x.h <= targetMax)
  if (fitsMax.length === 0) {
    return scored.reduce((best, x) => (x.h < best.h ? x : best)).s
  }
  const inRange = fitsMax.filter((x) => x.h >= targetMin)
  const pool = inRange.length > 0 ? inRange : fitsMax
  return pool.reduce((best, x) => {
    const dBest = Math.abs(best.h - targetHeight)
    const dX = Math.abs(x.h - targetHeight)
    if (dX < dBest) return x
    if (dX > dBest) return best
    return x.s < best.s ? x : best
  }).s
}

export function formatDollarsPerPixel(dollarsPerPixel: number): string {
  return `$${formatScaleNumber(dollarsPerPixel)}/px`
}

export function formatMinFlowHint(dollarsPerPixel: number): string {
  return `min $${formatScaleNumber(minFlowDollars(dollarsPerPixel))}`
}

function formatScaleNumber(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

export function stepDollarsPerPixel(current: number, direction: -1 | 1): number {
  const idx = SANKEY_DOLLARS_PER_PX_STEPS.indexOf(current)
  if (idx >= 0) {
    const next = idx + direction
    if (next >= 0 && next < SANKEY_DOLLARS_PER_PX_STEPS.length) {
      return SANKEY_DOLLARS_PER_PX_STEPS[next]!
    }
  }
  const sorted = [...SANKEY_DOLLARS_PER_PX_STEPS]
  if (direction > 0) {
    const greater = sorted.find((s) => s > current)
    return greater ?? sorted[sorted.length - 1]!
  }
  const lesser = [...sorted].reverse().find((s) => s < current)
  return lesser ?? sorted[0]!
}
