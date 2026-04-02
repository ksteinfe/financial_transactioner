import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { useCallback, useMemo, useState, useId, type PointerEvent, type ReactElement } from 'react'
import type { SankeySectionModel } from './model/sankeyTypes.js'
import { getSankeyNodeFill } from './sankeyColors.js'

const SECTION_TITLE_H = 28
const SECTION_GAP = 24
const STACK_GAP = 8

interface SankeyChartProps {
  sections: SankeySectionModel[]
  width: number
  height: number
  nodeOverrides: Record<string, { dx: number; dy: number }>
  onNodeDrag: (nodeId: string, dx: number, dy: number) => void
  onHover: (payload: { kind: 'node' | 'link'; section: string; text: string } | null) => void
}

type SnNode = {
  id: string
  raw: SankeySectionModel['nodes'][0]
  x0?: number
  x1?: number
  y0?: number
  y1?: number
}

type SnLink = {
  source: SnNode
  target: SnNode
  value: number
  id: string
  width?: number
}

function adjustStackedBalances(nodes: SnNode[]): void {
  const find = (kind: SnNode['raw']['kind']) => nodes.find((n) => n.raw.kind === kind)
  const ti = find('total-inflow')
  const def = find('deficit')
  const to = find('total-outflow')
  const sur = find('surplus')
  if (ti && def) {
    const h = Math.max(2, (def.y1 ?? 0) - (def.y0 ?? 0))
    const x0 = ti.x0 ?? 0
    const x1 = ti.x1 ?? 0
    const y0 = (ti.y1 ?? 0) + STACK_GAP
    def.x0 = x0
    def.x1 = x1
    def.y0 = y0
    def.y1 = y0 + h
  }
  if (to && sur) {
    const h = Math.max(2, (sur.y1 ?? 0) - (sur.y0 ?? 0))
    const x0 = to.x0 ?? 0
    const x1 = to.x1 ?? 0
    const y0 = (to.y1 ?? 0) + STACK_GAP
    sur.x0 = x0
    sur.x1 = x1
    sur.y0 = y0
    sur.y1 = y0 + h
  }
}

function layoutSection(section: SankeySectionModel, innerW: number, innerH: number): { nodes: SnNode[]; links: SnLink[] } {
  if (!section.hasActivity || section.nodes.length === 0) {
    return { nodes: [], links: [] }
  }
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
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const sn = sankey<SnNode, { source: number; target: number; value: number; id: string }>()
    .nodeWidth(14)
    .nodePadding(8)
    .extent([
      [4, 4],
      [innerW - 4, innerH - 4]
    ])

  const graph = sn({
    nodes: [...nodes],
    links: linkData.map((l) => ({ ...l }))
  })

  const outNodes = graph.nodes as SnNode[]
  adjustStackedBalances(outNodes)

  const outLinks: SnLink[] = graph.links.map((l) => {
    const s = l.source as unknown as SnNode
    const t = l.target as unknown as SnNode
    return {
      source: s,
      target: t,
      value: l.value,
      id: (l as unknown as { id?: string }).id ?? '',
      width: (l as unknown as { width?: number }).width
    }
  })

  return { nodes: outNodes, links: outLinks }
}

export function SankeyChart({
  sections,
  width,
  height,
  nodeOverrides,
  onNodeDrag,
  onHover
}: SankeyChartProps): ReactElement {
  const filterId = useId().replace(/:/g, '')
  const activeSections = sections.filter((s) => s.hasActivity)
  const nSec = Math.max(1, activeSections.length)
  const blockH = (height - SECTION_GAP * (nSec - 1)) / nSec
  const innerH = Math.max(100, blockH - SECTION_TITLE_H - 8)

  const layouts = useMemo(() => {
    return activeSections.map((section) => ({
      section,
      ...layoutSection(section, width, innerH)
    }))
  }, [activeSections, width, innerH])

  const linkPath = useMemo(() => sankeyLinkHorizontal(), [])

  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number } | null>(null)

  const onPointerDown = useCallback((e: PointerEvent, nodeId: string) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging({ id: nodeId, startX: e.clientX, startY: e.clientY })
  }, [])

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging) return
      e.stopPropagation()
      const dx = e.clientX - dragging.startX
      const dy = e.clientY - dragging.startY
      onNodeDrag(dragging.id, dx, dy)
      setDragging({ ...dragging, startX: e.clientX, startY: e.clientY })
    },
    [dragging, onNodeDrag]
  )

  const onPointerUp = useCallback((e: PointerEvent) => {
    e.stopPropagation()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ok */
    }
    setDragging(null)
  }, [])

  if (activeSections.length === 0) {
    return (
      <g className="sankey-root" aria-hidden>
        <text x={width / 2 - 120} y={height / 2} fill="var(--sankey-muted, #64748b)" fontSize={13}>
          No diagram data for the selected range.
        </text>
      </g>
    )
  }

  return (
    <g className="sankey-root" aria-label="Sankey diagram">
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.2" />
        </filter>
      </defs>
      <rect width={width} height={height} fill="transparent" pointerEvents="none" />
      {layouts.map((lay, idx) => {
        const ty = idx * (blockH + SECTION_GAP)
        const gkey = lay.section.id
        return (
          <g key={gkey} transform={`translate(0,${ty})`}>
            <text x={4} y={16} fill="var(--sankey-fg, #1e293b)" fontSize={14} fontWeight={600}>
              {lay.section.label}
            </text>
            <g transform={`translate(0,${SECTION_TITLE_H})`}>
              {lay.nodes.length === 0 ? (
                <text x={width / 2 - 70} y={innerH / 2} fill="var(--sankey-muted, #64748b)" fontSize={13}>
                  No activity in range
                </text>
              ) : (
                <>
                  <g className="sankey-links">
                    {lay.links.map((l, li) => {
                      const d = linkPath(l as unknown as Parameters<typeof linkPath>[0])
                      if (!d) return null
                      const sw = Math.max(2.5, l.width ?? 2.5)
                      return (
                        <path
                          key={`${l.source.id}-${l.target.id}-${li}`}
                          d={d}
                          fill="none"
                          stroke="var(--sankey-link-stroke, #64748b)"
                          strokeOpacity={0.92}
                          strokeWidth={sw}
                          strokeLinecap="round"
                          pointerEvents="stroke"
                          onMouseEnter={() =>
                            onHover({
                              kind: 'link',
                              section: lay.section.label,
                              text: `${l.source.raw.label} → ${l.target.raw.label}`
                            })
                          }
                          onMouseLeave={() => onHover(null)}
                        />
                      )
                    })}
                  </g>
                  <g className="sankey-nodes">
                    {lay.nodes.map((d) => {
                      const o = nodeOverrides[d.id] ?? { dx: 0, dy: 0 }
                      const h = Math.max(2, (d.y1 ?? 0) - (d.y0 ?? 0))
                      const w = Math.max(2, (d.x1 ?? 0) - (d.x0 ?? 0))
                      const fs = Math.min(14, Math.max(9, Math.sqrt(h) * 1.8))
                      return (
                        <g
                          key={d.id}
                          transform={`translate(${(d.x0 ?? 0) + o.dx},${(d.y0 ?? 0) + o.dy})`}
                          onPointerDown={(e) => onPointerDown(e, d.id)}
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                          style={{ cursor: 'grab', touchAction: 'none' }}
                        >
                          <rect
                            width={w}
                            height={h}
                            rx={3}
                            fill={getSankeyNodeFill(d.raw)}
                            stroke="var(--sankey-node-stroke, rgba(15,23,42,0.18))"
                            strokeWidth={1}
                            filter={`url(#${filterId})`}
                          />
                          <text
                            x={w + 6}
                            y={h / 2 + 4}
                            fill="var(--sankey-fg, #1e293b)"
                            fontSize={fs}
                            pointerEvents="none"
                          >
                            {d.raw.label.length > 22 ? `${d.raw.label.slice(0, 20)}…` : d.raw.label}
                          </text>
                        </g>
                      )
                    })}
                  </g>
                </>
              )}
            </g>
          </g>
        )
      })}
    </g>
  )
}
