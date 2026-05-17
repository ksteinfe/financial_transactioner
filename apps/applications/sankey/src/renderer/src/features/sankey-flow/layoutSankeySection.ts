import { sankey, type SankeyGraph, type SankeyLink, type SankeyNode } from 'd3-sankey'
import type { SankeyNodeKind, SankeySectionModel } from './model/sankeyTypes.js'
import {
  flowToHeightPx,
  flowToHeightPxRaw,
  linkVisualHeightPx,
  measureSankeySectionHeight
} from './sankeyScale.js'

export { measureSankeySectionHeight } from './sankeyScale.js'

export type SnNode = SankeyNode<{ id: string; raw: SankeySectionModel['nodes'][0] }, { value: number; id: string }>

export type SnLink = SankeyLink<SnNode, { value: number; id: string }>

export type SectionLayout = {
  nodes: SnNode[]
  links: SnLink[]
  sankey: ReturnType<typeof sankey<SnNode, { value: number; id: string }>>
  extent: [[number, number], [number, number]]
  nodePadding: number
  /** Inner diagram height (extent span) used for this section. */
  contentHeight: number
  dollarsPerPixel: number
}

const KIND_STACK_RANK: Partial<Record<SankeyNodeKind, number>> = {
  'total-inflow': 0,
  deficit: 1,
  'total-outflow': 0,
  surplus: 1
}

const EXTENT_MARGIN = 4

/** Column positions match the main graph (cols 1–4 of five). */
export const SANKEY_MAIN_COLUMN_COUNT = 5

/**
 * Horizontal placement for model columns 1–5 on the main grid.
 * Columns 2 and 3 are closer (gap is 1/3 of the standard gap) so inward-facing labels fit.
 */
export function columnXFraction(column: number): number {
  switch (column) {
    case 1:
      return 0
    case 2:
      return 0.3
    case 3:
      return 0.4
    case 4:
      return 0.7
    case 5:
      return 1
    default:
      return 0
  }
}

function columnXBandOnMainGrid(
  column: number,
  extent: [[number, number], [number, number]],
  nodeWidth: number
): { x0: number; x1: number } {
  const [[xMin], [xMax]] = extent
  const innerSpan = xMax - xMin - nodeWidth
  const frac = columnXFraction(column)
  const x0 = xMin + frac * innerSpan
  return { x0, x1: x0 + nodeWidth }
}

function stackRank(kind: SankeyNodeKind): number {
  return KIND_STACK_RANK[kind] ?? 100
}

function nodeCenterY(n: SnNode): number {
  return ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2
}

function sankeyNodeSort(a: SnNode, b: SnNode): number {
  const col = a.raw.column - b.raw.column
  if (col !== 0) return col
  const d = stackRank(a.raw.kind) - stackRank(b.raw.kind)
  if (d !== 0) return d
  const aStack = a.raw.stackOrder
  const bStack = b.raw.stackOrder
  if (aStack != null && bStack != null) {
    return aStack - bStack
  }
  const dv = b.raw.sortValue - a.raw.sortValue
  if (dv !== 0) return dv
  return a.raw.label.localeCompare(b.raw.label)
}

type LinkDatum = { source: number; target: number; value: number; id: string }

/** Map present model columns to contiguous d3 layers (sparse months may skip columns). */
function buildContiguousLayerMap(nodes: { raw: { column: number } }[]): Map<number, number> {
  const cols = [...new Set(nodes.map((n) => n.raw.column))].sort((a, b) => a - b)
  return new Map(cols.map((c, i) => [c, i]))
}

/** Drop nodes not incident to any link; re-index link endpoints. */
function pruneToLinkedSubgraph(
  nodes: SnNode[],
  linkData: LinkDatum[]
): { nodes: SnNode[]; links: LinkDatum[] } {
  if (linkData.length === 0) return { nodes: [], links: [] }
  const used = new Set<number>()
  for (const l of linkData) {
    used.add(l.source)
    used.add(l.target)
  }
  const indexMap = new Map<number, number>()
  const kept: SnNode[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    if (!used.has(i)) continue
    indexMap.set(i, kept.length)
    kept.push(nodes[i]!)
  }
  const links = linkData.map((l) => ({
    ...l,
    source: indexMap.get(l.source)!,
    target: indexMap.get(l.target)!
  }))
  return { nodes: kept, links }
}

function assignNodeValues(nodes: SnNode[], linkData: LinkDatum[]): void {
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

function nodeHeightPx(node: SnNode, dollarsPerPixel: number): number {
  return flowToHeightPx(node.value ?? 0, dollarsPerPixel)
}

/**
 * Stack link bands by neighbor y (d3 default), after node positions are final.
 * Incoming: order by source y; outgoing: order by target y — reduces crossings.
 */
export function reorderLinksByNeighborY(nodes: SnNode[]): void {
  for (const node of nodes) {
    node.sourceLinks.sort((a, b) => {
      const d = nodeCenterY(a.target) - nodeCenterY(b.target)
      return d !== 0 ? d : a.target.raw.label.localeCompare(b.target.raw.label)
    })
    node.targetLinks.sort((a, b) => {
      const d = nodeCenterY(a.source) - nodeCenterY(b.source)
      return d !== 0 ? d : a.source.raw.label.localeCompare(b.source.raw.label)
    })
  }
}

function applyGlobalNodeHeights(nodes: SnNode[], dollarsPerPixel: number): void {
  for (const n of nodes) {
    const h = nodeHeightPx(n, dollarsPerPixel)
    n.y0 = 0
    n.y1 = h
  }
}

/**
 * Place attach points along real ($/px) offsets; stroke is centered on each point using
 * {@link linkVisualHeightPx} so sub-minimum bundles can overlap visually.
 */
function stackLinksOnNodeSide(
  links: SnLink[],
  side: 'source' | 'target',
  yMin: number,
  span: number,
  dollarsPerPixel: number
): void {
  if (links.length === 0 || span <= 0) return

  const layoutWs = links.map((l) => flowToHeightPxRaw(l.value, dollarsPerPixel))
  const visualWs = links.map((l) => linkVisualHeightPx(l.value, dollarsPerPixel))
  let layoutSum = layoutWs.reduce((a, b) => a + b, 0)
  const scale = layoutSum > span && layoutSum > 0 ? span / layoutSum : 1
  layoutSum *= scale
  const bundlePad = layoutSum < span ? (span - layoutSum) / 2 : 0

  const placed: { link: SnLink; y: number; half: number }[] = []
  let layoutCursor = 0
  for (let i = 0; i < links.length; i += 1) {
    const link = links[i]!
    const layoutW = layoutWs[i]! * scale
    const visualW = visualWs[i]!
    const layoutCenter = bundlePad + layoutCursor + layoutW / 2
    layoutCursor += layoutW
    link.width = visualW
    placed.push({ link, y: yMin + layoutCenter, half: visualW / 2 })
  }

  const top = Math.min(...placed.map((p) => p.y - p.half))
  const bottom = Math.max(...placed.map((p) => p.y + p.half))
  const shift = yMin + span / 2 - (top + bottom) / 2

  for (const { link, y } of placed) {
    const centered = y + shift
    if (side === 'source') link.y0 = centered
    else link.y1 = centered
  }
}

function computeLinkBreadthsFromRealScale(nodes: SnNode[], dollarsPerPixel: number): void {
  for (const node of nodes) {
    const span = (node.y1 ?? 0) - (node.y0 ?? 0)
    const yMin = node.y0 ?? 0
    if (span <= 0) continue
    stackLinksOnNodeSide(node.sourceLinks, 'source', yMin, span, dollarsPerPixel)
    stackLinksOnNodeSide(node.targetLinks, 'target', yMin, span, dollarsPerPixel)
  }
}

function finalizeLinkLayout(
  graph: SankeyGraph<SnNode, { value: number; id: string }>,
  dollarsPerPixel: number
): void {
  reorderLinksByNeighborY(graph.nodes)
  computeLinkBreadthsFromRealScale(graph.nodes, dollarsPerPixel)
}

/** Same x per model column on the main 5-column grid; stack nodes top-down at global scale heights. */
function alignColumnsTop(
  nodes: SnNode[],
  padding: number,
  extent: [[number, number], [number, number]],
  dollarsPerPixel: number,
  nodeWidth: number
): void {
  const [[, yMin]] = extent
  const byCol = new Map<number, SnNode[]>()
  for (const n of nodes) {
    if (!byCol.has(n.raw.column)) byCol.set(n.raw.column, [])
    byCol.get(n.raw.column)!.push(n)
  }
  for (const [column, colNodes] of byCol) {
    const { x0, x1 } = columnXBandOnMainGrid(column, extent, nodeWidth)
    colNodes.sort(sankeyNodeSort)
    let y = yMin
    for (const n of colNodes) {
      const h = nodeHeightPx(n, dollarsPerPixel)
      n.x0 = x0
      n.x1 = x1
      n.y0 = y
      n.y1 = y + h
      y += h + padding
    }
  }
}

function postProcessLayout(
  graph: SankeyGraph<SnNode, { value: number; id: string }>,
  padding: number,
  extent: [[number, number], [number, number]],
  dollarsPerPixel: number,
  nodeWidth: number
): void {
  applyGlobalNodeHeights(graph.nodes, dollarsPerPixel)
  alignColumnsTop(graph.nodes, padding, extent, dollarsPerPixel, nodeWidth)
}

export function layoutSankeySection(
  section: SankeySectionModel,
  innerW: number,
  dollarsPerPixel: number
): SectionLayout | null {
  if (!section.hasActivity || section.nodes.length === 0) {
    return null
  }

  const nodePadding = 8
  const contentHeight = Math.max(40, measureSankeySectionHeight(section, nodePadding, dollarsPerPixel))
  const extent: [[number, number], [number, number]] = [
    [EXTENT_MARGIN, EXTENT_MARGIN],
    [innerW - EXTENT_MARGIN, contentHeight - EXTENT_MARGIN]
  ]

  const idToIndex = new Map<string, number>()
  section.nodes.forEach((n, i) => idToIndex.set(n.id, i))
  const nodes = section.nodes.map((n) => ({ id: n.id, raw: n })) as SnNode[]
  const linkData = section.links
    .map((l) => {
      const s = idToIndex.get(l.source)
      const t = idToIndex.get(l.target)
      if (s === undefined || t === undefined) return null
      return { source: s, target: t, value: l.value, id: l.id }
    })
    .filter((x): x is LinkDatum => x !== null)

  const pruned = pruneToLinkedSubgraph(nodes, linkData)
  if (pruned.nodes.length === 0 || pruned.links.length === 0) {
    return null
  }

  const layerByColumn = buildContiguousLayerMap(pruned.nodes)
  const nodeWidth = 14

  const sn = sankey<SnNode, { value: number; id: string }>()
    .nodeWidth(nodeWidth)
    .nodePadding(nodePadding)
    .nodeAlign((node) => layerByColumn.get(node.raw.column) ?? 0)
    .nodeSort(sankeyNodeSort)
    .extent(extent)

  const graph: SankeyGraph<SnNode, { value: number; id: string }> = sn({
    nodes: [...pruned.nodes],
    links: pruned.links.map((l) => ({ ...l }))
  })

  postProcessLayout(graph, nodePadding, extent, dollarsPerPixel, nodeWidth)
  finalizeLinkLayout(graph, dollarsPerPixel)

  return {
    nodes: graph.nodes,
    links: graph.links,
    sankey: sn,
    extent,
    nodePadding,
    contentHeight,
    dollarsPerPixel
  }
}

/** Looser bounds for manual drag (layout extent is tight when nodes are tall). */
function dragExtent(layout: SectionLayout): [[number, number], [number, number]] {
  const [[xMin, yMin], [xMax, yMax]] = layout.extent
  const spanY = yMax - yMin
  const marginY = Math.max(48, spanY * 0.4)
  return [
    [xMin, yMin - marginY],
    [xMax, yMax + marginY]
  ]
}

/** Place node top-left at layout coordinates; re-attach links via d3-sankey `update`. */
export function moveSankeyNodeTo(layout: SectionLayout, nodeId: string, x0: number, y0: number): void {
  const node = layout.nodes.find((n) => n.id === nodeId)
  if (!node || node.x0 == null || node.x1 == null || node.y0 == null || node.y1 == null) return

  const [[xMin, yMin], [xMax, yMax]] = dragExtent(layout)
  const w = node.x1 - node.x0
  const h = node.y1 - node.y0

  node.x0 = Math.max(xMin, Math.min(xMax - w, x0))
  node.x1 = node.x0 + w
  node.y0 = Math.max(yMin, Math.min(yMax - h, y0))
  node.y1 = node.y0 + h

  finalizeLinkLayout({ nodes: layout.nodes, links: layout.links }, layout.dollarsPerPixel)
}

/** Move a node by a delta in layout coordinates (tests / incremental nudges). */
export function dragSankeyNode(layout: SectionLayout, nodeId: string, dx: number, dy: number): void {
  const node = layout.nodes.find((n) => n.id === nodeId)
  if (!node || node.x0 == null || node.y0 == null) return
  moveSankeyNodeTo(layout, nodeId, node.x0 + dx, node.y0 + dy)
}
