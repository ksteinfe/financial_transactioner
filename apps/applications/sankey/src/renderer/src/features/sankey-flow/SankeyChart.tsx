import { sankeyLinkHorizontal } from 'd3-sankey'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactElement
} from 'react'
import { formatCurrencyShort } from './model/formatCurrencyShort.js'
import { SANKEY_SECTION_DISPLAY_ORDER, type SankeySectionId, type SankeySectionModel } from './model/sankeyTypes.js'
import { getSankeyNodeFill } from './sankeyColors.js'
import {
  layoutSankeySection,
  moveSankeyNodeTo,
  type SectionLayout,
  type SnLink,
  type SnNode
} from './layoutSankeySection.js'
import { clientToLayoutPoint } from './sankeyPointer.js'
import {
  buildInitialExpandedById,
  formatCollapsibleSectionTitle,
  isCollapsibleSection,
  isSectionBalanced
} from './sectionTitle.js'
import {
  linkVisualHeightPx,
  nodeLabelFontSizePx,
  SANKEY_EMPTY_CHART_H,
  SANKEY_SECTION_GAP,
  SANKEY_SECTION_TITLE_H
} from './sankeyScale.js'

export type { SnNode, SnLink }
export { layoutSankeySection as layoutSection }

export type SankeyHoverInfo =
  | {
      kind: 'link'
      section: string
      source: string
      target: string
      amount: string
    }
  | {
      kind: 'node'
      section: string
      label: string
      amount: string
    }

type SectionLayoutState = {
  section: SankeySectionModel
  offsetY: number
  expanded: boolean
  layout: SectionLayout | null
}

interface SankeyChartProps {
  sections: SankeySectionModel[]
  width: number
  dollarsPerPixel: number
  /** Increment to reset node positions to the automatic layout */
  layoutResetKey?: number
  onHover: (payload: SankeyHoverInfo | null) => void
  onContentHeightChange?: (height: number) => void
}

function sectionDisplayTitle(section: SankeySectionModel): string {
  return isCollapsibleSection(section.id) ? formatCollapsibleSectionTitle(section) : section.label
}

/** Small stroke chevron: right when collapsed, down when expanded. */
function sectionChevronPath(expanded: boolean): string {
  return expanded ? 'M4 6 L8 11 L12 6' : 'M5 5 L9 10 L5 15'
}

export function SankeyChart({
  sections,
  width,
  dollarsPerPixel,
  layoutResetKey = 0,
  onHover,
  onContentHeightChange
}: SankeyChartProps): ReactElement {
  const activeSections = useMemo(() => {
    const rank = new Map(SANKEY_SECTION_DISPLAY_ORDER.map((id, i) => [id, i]))
    return sections
      .filter((s) => s.hasActivity)
      .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99))
  }, [sections])

  const balanceKey = useMemo(
    () => activeSections.map((s) => `${s.id}:${s.surplus}:${s.deficit}`).join('|'),
    [activeSections]
  )

  const layoutSeed = useMemo(() => {
    return (
      `${layoutResetKey}|${dollarsPerPixel}|${balanceKey}|${width}|` +
      activeSections.map((s) => `${s.nodes.length}:${s.links.length}`).join(',')
    )
  }, [activeSections, width, layoutResetKey, dollarsPerPixel, balanceKey])

  const [expandedById, setExpandedById] = useState<Partial<Record<SankeySectionId, boolean>>>(() =>
    buildInitialExpandedById(activeSections)
  )

  useEffect(() => {
    setExpandedById(buildInitialExpandedById(activeSections))
  }, [balanceKey, activeSections])

  const isSectionExpanded = useCallback(
    (section: SankeySectionModel): boolean => {
      if (!isCollapsibleSection(section.id)) return true
      if (expandedById[section.id] !== undefined) return expandedById[section.id]!
      return !isSectionBalanced(section)
    },
    [expandedById]
  )

  const toggleSection = useCallback((sectionId: SankeySectionId) => {
    setExpandedById((prev) => {
      const section = activeSections.find((s) => s.id === sectionId)
      if (!section) return prev
      const current = prev[sectionId] ?? !isSectionBalanced(section)
      return { ...prev, [sectionId]: !current }
    })
  }, [activeSections])

  const [layouts, setLayouts] = useState<SectionLayoutState[]>([])
  const [totalHeight, setTotalHeight] = useState(SANKEY_EMPTY_CHART_H)

  useEffect(() => {
    let offsetY = 0
    const next: SectionLayoutState[] = []
    for (const section of activeSections) {
      const expanded = isSectionExpanded(section)
      const layout = expanded ? layoutSankeySection(section, width, dollarsPerPixel) : null
      if (expanded && !layout) continue
      next.push({ section, offsetY, expanded, layout })
      const contentHeight = layout?.contentHeight ?? 0
      offsetY += SANKEY_SECTION_TITLE_H + contentHeight + SANKEY_SECTION_GAP
    }
    const h = next.length > 0 ? offsetY - SANKEY_SECTION_GAP : SANKEY_EMPTY_CHART_H
    setLayouts(next)
    setTotalHeight(h)
    onContentHeightChange?.(h)
  }, [layoutSeed, activeSections, width, dollarsPerPixel, onContentHeightChange, expandedById, isSectionExpanded])

  const linkPath = useMemo(() => sankeyLinkHorizontal(), [])

  const rootRef = useRef<SVGGElement>(null)
  const dragRef = useRef<{
    sectionId: string
    nodeId: string
    layoutOffsetY: number
    grabOffsetX: number
    grabOffsetY: number
  } | null>(null)

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)

  const sectionLayoutOffsetY = useCallback(
    (sectionId: string) => {
      const row = layouts.find((l) => l.section.id === sectionId)
      if (!row) return SANKEY_SECTION_TITLE_H
      return row.offsetY + SANKEY_SECTION_TITLE_H
    },
    [layouts]
  )

  const onPointerDown = useCallback(
    (e: PointerEvent, sectionId: string, nodeId: string) => {
      e.stopPropagation()
      e.preventDefault()
      const root = rootRef.current
      const svg = root?.ownerSVGElement
      const row = layouts.find((l) => l.section.id === sectionId)
      const node = row?.layout?.nodes.find((n) => n.id === nodeId)
      if (!root || !svg || !row?.layout || !node || node.x0 == null || node.y0 == null) return

      const layoutOffsetY = sectionLayoutOffsetY(sectionId)
      const pt = clientToLayoutPoint(svg, root, layoutOffsetY, e.clientX, e.clientY)
      dragRef.current = {
        sectionId,
        nodeId,
        layoutOffsetY,
        grabOffsetX: pt.x - node.x0,
        grabOffsetY: pt.y - node.y0
      }
      setDraggingNodeId(nodeId)
      root.setPointerCapture(e.pointerId)
    },
    [layouts, sectionLayoutOffsetY]
  )

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current
      const root = rootRef.current
      const svg = root?.ownerSVGElement
      if (!drag || !root || !svg) return
      e.stopPropagation()
      e.preventDefault()
      const pt = clientToLayoutPoint(svg, root, drag.layoutOffsetY, e.clientX, e.clientY)
      const x0 = pt.x - drag.grabOffsetX
      const y0 = pt.y - drag.grabOffsetY
      setLayouts((prev) =>
        prev.map((row) => {
          if (row.section.id !== drag.sectionId || !row.layout) return row
          moveSankeyNodeTo(row.layout, drag.nodeId, x0, y0)
          return { ...row, layout: { ...row.layout } }
        })
      )
    },
    []
  )

  const endDrag = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return
    e.stopPropagation()
    try {
      rootRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ok */
    }
    dragRef.current = null
    setDraggingNodeId(null)
  }, [])

  if (activeSections.length === 0) {
    return (
      <g className="sankey-root" aria-hidden>
        <text x={width / 2 - 120} y={SANKEY_EMPTY_CHART_H / 2} fill="var(--sankey-muted, #64748b)" fontSize={13}>
          No diagram data for the selected range.
        </text>
      </g>
    )
  }

  return (
    <g
      ref={rootRef}
      className="sankey-root"
      aria-label="Sankey diagram"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <rect width={width} height={totalHeight} fill="transparent" pointerEvents="none" />
      {layouts.map((row) => {
        const ty = row.offsetY
        const gkey = row.section.id
        const collapsible = isCollapsibleSection(row.section.id)
        const title = sectionDisplayTitle(row.section)
        const lay = row.layout

        return (
          <g key={gkey} transform={`translate(0,${ty})`}>
            {collapsible ? (
              <g className="sankey-section-header">
                <rect
                  x={0}
                  y={0}
                  width={width}
                  height={SANKEY_SECTION_TITLE_H}
                  fill="transparent"
                  className="sankey-section-header-hit sankey-interactive"
                  role="button"
                  aria-expanded={row.expanded}
                  aria-label={`${title}, ${row.expanded ? 'expanded' : 'collapsed'}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSection(row.section.id)
                  }}
                />
                <path
                  d={sectionChevronPath(row.expanded)}
                  fill="none"
                  stroke="var(--sankey-muted, #64748b)"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
                <text
                  x={20}
                  y={16}
                  fill="var(--sankey-fg, #1e293b)"
                  fontSize={14}
                  fontWeight={600}
                  pointerEvents="none"
                >
                  {title}
                </text>
              </g>
            ) : (
              <text x={4} y={16} fill="var(--sankey-fg, #1e293b)" fontSize={14} fontWeight={600}>
                {title}
              </text>
            )}
            {row.expanded && lay ? (
              <g transform={`translate(0,${SANKEY_SECTION_TITLE_H})`}>
                {lay.nodes.length === 0 ? (
                  <text x={width / 2 - 70} y={lay.contentHeight / 2} fill="var(--sankey-muted, #64748b)" fontSize={13}>
                    No activity in range
                  </text>
                ) : (
                  <>
                    <g className="sankey-links sankey-interactive">
                      {[...lay.links]
                        .sort((a, b) => b.value - a.value)
                        .map((l, li) => {
                          const d = linkPath(l)
                          if (!d || d.includes('NaN')) return null
                          const sw = linkVisualHeightPx(l.value, lay.dollarsPerPixel)
                          return (
                            <path
                              key={`${l.source.id}-${l.target.id}-${li}`}
                              d={d}
                              fill="none"
                              stroke="var(--sankey-link-stroke, #e0e0e0)"
                              strokeOpacity={0.58}
                              strokeWidth={sw}
                              strokeLinecap="butt"
                              pointerEvents="stroke"
                              onMouseEnter={() =>
                                onHover({
                                  kind: 'link',
                                  section: title,
                                  source: l.source.raw.label,
                                  target: l.target.raw.label,
                                  amount: formatCurrencyShort(l.value)
                                })
                              }
                              onMouseLeave={() => onHover(null)}
                            />
                          )
                        })}
                    </g>
                    <g className="sankey-nodes sankey-interactive">
                      {lay.nodes.map((d) => {
                        const h = Math.max(2, (d.y1 ?? 0) - (d.y0 ?? 0))
                        const w = Math.max(2, (d.x1 ?? 0) - (d.x0 ?? 0))
                        const fs = nodeLabelFontSizePx(h, lay.dollarsPerPixel)
                        const labelGap = 6
                        const labelLeft = d.raw.column === 1 || d.raw.column === 2
                        const shown = d.raw.displayLabel ?? d.raw.label
                        const labelText = shown.length > 22 ? `${shown.slice(0, 20)}…` : shown
                        return (
                          <g
                            key={d.id}
                            transform={`translate(${d.x0 ?? 0},${d.y0 ?? 0})`}
                            onPointerDown={(e) => onPointerDown(e, row.section.id, d.id)}
                            className={draggingNodeId === d.id ? 'sankey-node-dragging' : undefined}
                            style={{ touchAction: 'none' }}
                          >
                            <rect
                              width={w}
                              height={h}
                              fill={getSankeyNodeFill(d.raw)}
                              onMouseEnter={() =>
                                onHover({
                                  kind: 'node',
                                  section: title,
                                  label: d.raw.label,
                                  amount: d.raw.formattedValue
                                })
                              }
                              onMouseLeave={() => onHover(null)}
                            />
                            <text
                              x={labelLeft ? -labelGap : w + labelGap}
                              y={h / 2 + 4}
                              textAnchor={labelLeft ? 'end' : 'start'}
                              fill="var(--sankey-fg, #1e293b)"
                              fontSize={fs}
                              pointerEvents="none"
                            >
                              {labelText}
                            </text>
                          </g>
                        )
                      })}
                    </g>
                  </>
                )}
              </g>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
