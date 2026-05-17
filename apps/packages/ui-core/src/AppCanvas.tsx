import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'

export interface CanvasTransform {
  x: number
  y: number
  k: number
}

export interface AppCanvasProps {
  children: ReactNode
  className?: string
  minZoom?: number
  maxZoom?: number
  initialFit?: boolean
  enablePan?: boolean
  enableZoom?: boolean
  onTransformChange?: (transform: CanvasTransform) => void
  /** Replaces default Fit / Reset buttons when set */
  controls?: ReactNode
  /** Extra buttons shown after default controls (ignored when `controls` is set) */
  toolbarExtra?: ReactNode
  /** Centered toolbar content (e.g. diagram scale readout) */
  toolbarCenter?: ReactNode
  /** Right-aligned readout (e.g. hover details); keeps toolbar height stable when content changes */
  toolbarInfo?: ReactNode
  /** Optional explicit bounds (SVG user units) for fit-to-view when content bbox is not yet measurable */
  contentBounds?: { width: number; height: number }
  /** When this value changes, `initialFit` runs again (e.g. new diagram data). Omit to fit once on mount. */
  contentFitKey?: string | number
}

function transformToCanvas(t: { x: number; y: number; k: number }): CanvasTransform {
  return { x: t.x, y: t.y, k: t.k }
}

export function AppCanvas({
  children,
  className,
  minZoom = 0.1,
  maxZoom = 8,
  initialFit = false,
  enablePan = true,
  enableZoom = true,
  onTransformChange,
  controls,
  toolbarExtra,
  toolbarCenter,
  toolbarInfo,
  contentBounds,
  contentFitKey
}: AppCanvasProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<SVGGElement | null>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const onTransformChangeRef = useRef(onTransformChange)
  onTransformChangeRef.current = onTransformChange

  const contentW = contentBounds?.width ?? 0
  const contentH = contentBounds?.height ?? 0

  const notify = useCallback((t: { x: number; y: number; k: number }) => {
    onTransformChangeRef.current?.(transformToCanvas(t))
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    const g = contentRef.current
    if (!svg || !g) return

    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([minZoom, maxZoom])
      .filter((event) => {
        const et = event.type
        if (et === 'wheel') return enableZoom
        if (!enablePan && (et === 'mousedown' || et === 'mousemove')) return false
        // Primary button only for pan; let zoom handle wheel
        if (et === 'mousedown' && event instanceof MouseEvent && event.button !== 0) return false
        if (et === 'mousedown' || et === 'pointerdown' || et === 'touchstart') {
          const target = event.target
          if (target instanceof Element && target.closest('.sankey-interactive')) return false
        }
        return true
      })
      .on('start', () => {
        viewportRef.current?.classList.add('txn-app-canvas-panning')
      })
      .on('end', () => {
        viewportRef.current?.classList.remove('txn-app-canvas-panning')
      })
      .on('zoom', (event) => {
        const t = event.transform
        g.setAttribute('transform', t.toString())
        notify(t)
      })

    zoomBehaviorRef.current = z
    select(svg).call(z)
    select(svg).on('dblclick.zoom', null)

    return () => {
      select(svg).on('.zoom', null)
      zoomBehaviorRef.current = null
    }
  }, [enablePan, enableZoom, maxZoom, minZoom, notify])

  const fitToView = useCallback(() => {
    const svg = svgRef.current
    const content = contentRef.current
    const z = zoomBehaviorRef.current
    if (!svg || !content || !z) return

    let x = 0
    let y = 0
    let w = contentBounds?.width ?? 0
    let h = contentBounds?.height ?? 0
    try {
      const bbox = content.getBBox()
      if (bbox.width > 0 && bbox.height > 0) {
        x = bbox.x
        y = bbox.y
        w = bbox.width
        h = bbox.height
      }
    } catch {
      /* layout */
    }
    if (w <= 0 || h <= 0) return

    const rect = svg.getBoundingClientRect()
    const vw = rect.width
    const vh = rect.height
    if (vw <= 0 || vh <= 0) return

    const pad = 24
    const k = Math.min((vw - 2 * pad) / w, (vh - 2 * pad) / h, maxZoom)
    const clampedK = Math.max(k, minZoom)
    const tx = (vw - w * clampedK) / 2 - x * clampedK
    const ty = (vh - h * clampedK) / 2 - y * clampedK

    const t = zoomIdentity.translate(tx, ty).scale(clampedK)
    select(svg).call(z.transform, t)
  }, [contentW, contentH, maxZoom, minZoom])

  const resetView = useCallback(() => {
    const svg = svgRef.current
    const z = zoomBehaviorRef.current
    if (!svg || !z) return
    select(svg).call(z.transform, zoomIdentity)
  }, [])

  useEffect(() => {
    if (!initialFit) return
    const id = requestAnimationFrame(() => fitToView())
    return () => cancelAnimationFrame(id)
    // Only refit when content identity changes — not on every React child re-render (hover, zoom, drag).
  }, [initialFit, fitToView, contentFitKey])

  const defaultControls = useMemo(
    () => (
      <div className="txn-app-canvas-controls">
        <button type="button" onClick={() => fitToView()}>
          Fit to content
        </button>
        <button type="button" onClick={() => resetView()}>
          Reset view
        </button>
        {toolbarExtra}
      </div>
    ),
    [fitToView, resetView, toolbarExtra]
  )

  return (
    <div className={['txn-app-canvas-wrap', className].filter(Boolean).join(' ')}>
      <div
        className={[
          'txn-app-canvas-toolbar',
          toolbarCenter != null ? 'txn-app-canvas-toolbar--with-center' : ''
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="txn-app-canvas-toolbar-start">{controls ?? defaultControls}</div>
        {toolbarCenter != null ? (
          <div className="txn-app-canvas-toolbar-center">{toolbarCenter}</div>
        ) : null}
        {toolbarInfo != null ? (
          <div className="txn-app-canvas-toolbar-info" aria-live="polite">
            {toolbarInfo}
          </div>
        ) : null}
      </div>
      <div className="txn-app-canvas-viewport" ref={viewportRef}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="txn-app-canvas-svg"
          style={{ touchAction: 'none' }}
        >
          <g ref={contentRef} className="txn-app-canvas-content" transform="translate(0,0) scale(1)">
            {contentBounds ? (
              <rect
                className="txn-app-canvas-pan-layer"
                x={0}
                y={0}
                width={contentBounds.width}
                height={contentBounds.height}
                fill="rgba(0,0,0,0)"
                pointerEvents="all"
              />
            ) : null}
            {children}
          </g>
        </svg>
      </div>
    </div>
  )
}
