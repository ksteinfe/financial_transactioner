import type { ReactElement } from 'react'
import {
  formatDollarsPerPixel,
  formatMinFlowHint,
  SANKEY_DOLLARS_PER_PX_STEPS,
  stepDollarsPerPixel
} from './sankeyScale.js'

interface SankeyScaleToolbarProps {
  dollarsPerPixel: number
  onChange: (dollarsPerPixel: number) => void
}

export function SankeyScaleToolbar({ dollarsPerPixel, onChange }: SankeyScaleToolbarProps): ReactElement {
  const stepIdx = SANKEY_DOLLARS_PER_PX_STEPS.indexOf(dollarsPerPixel)
  const canFiner = stepIdx > 0
  const canCoarser = stepIdx >= 0 && stepIdx < SANKEY_DOLLARS_PER_PX_STEPS.length - 1

  return (
    <div className="sankey-scale-toolbar" role="group" aria-label="Diagram base scale">
      <button
        type="button"
        className="sankey-scale-step"
        disabled={!canFiner}
        aria-label="Finer scale (more detail, taller diagram)"
        onClick={() => onChange(stepDollarsPerPixel(dollarsPerPixel, -1))}
      >
        −
      </button>
      <div className="sankey-scale-labels">
        <span className="sankey-scale-label">{formatDollarsPerPixel(dollarsPerPixel)}</span>
        <span className="sankey-scale-min muted">{formatMinFlowHint(dollarsPerPixel)}</span>
      </div>
      <button
        type="button"
        className="sankey-scale-step"
        disabled={!canCoarser}
        aria-label="Coarser scale (less detail, shorter diagram)"
        onClick={() => onChange(stepDollarsPerPixel(dollarsPerPixel, 1))}
      >
        +
      </button>
    </div>
  )
}
