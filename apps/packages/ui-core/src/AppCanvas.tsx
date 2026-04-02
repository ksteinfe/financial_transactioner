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
  /** Optional explicit bounds (SVG user units) for fit-to-view when content bbox is not yet measurable */
  contentBounds?: { width: number; height: number }
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
  contentBounds
}: AppCanvasProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const contentRef = useRef<SVGGElement | null>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const notify = useCallback(
    (t: { x: number; y: number; k: number }) => {
      onTransformChange?.(transformToCanvas(t))
    },
    [onTransformChange]
  )

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
        return true
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

    let w = contentBounds?.width ?? 0
    let h = contentBounds?.height ?? 0
    try {
      const bbox = content.getBBox()
      if (bbox.width > 0 && bbox.height > 0) {
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
    const k = Math.min((vw - pad) / w, (vh - pad) / h, maxZoom)
    const clampedK = Math.max(k, minZoom)
    const tx = (vw - w * clampedK) / 2
    const ty = (vh - h * clampedK) / 2

    const t = zoomIdentity.translate(tx, ty).scale(clampedK)
    select(svg).call(z.transform, t)
  }, [contentBounds, maxZoom, minZoom])

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
  }, [initialFit, fitToView, children])

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
      <div className="txn-app-canvas-toolbar">{controls ?? defaultControls}</div>
      <div className="txn-app-canvas-viewport">
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
