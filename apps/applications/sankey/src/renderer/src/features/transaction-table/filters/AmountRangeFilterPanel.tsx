import { useState, type ReactElement } from 'react'
import type { AmountBounds } from '../filterBounds.js'
import type { AmountRangeFilter } from '../transactionFilters.js'
import { FilterPopover, FilterPopoverActions } from './FilterPopover.js'

export interface AmountRangeFilterPanelProps {
  bounds: AmountBounds
  value: AmountRangeFilter
  formatAmount: (n: number) => string
  ignoreCloseWithin?: HTMLElement | null
  onApply: (value: AmountRangeFilter) => void
  onClear: () => void
  onClose: () => void
}

function parseAmountInput(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

export function AmountRangeFilterPanel({
  bounds,
  value,
  formatAmount,
  ignoreCloseWithin,
  onApply,
  onClear,
  onClose
}: AmountRangeFilterPanelProps): ReactElement {
  const [minRaw, setMinRaw] = useState(value.min != null ? String(value.min) : '')
  const [maxRaw, setMaxRaw] = useState(value.max != null ? String(value.max) : '')

  const apply = () => {
    onApply({
      min: parseAmountInput(minRaw),
      max: parseAmountInput(maxRaw)
    })
    onClose()
  }

  const clear = () => {
    setMinRaw('')
    setMaxRaw('')
    onClear()
    onClose()
  }

  return (
    <FilterPopover
      title="Filter by amount"
      onClose={onClose}
      onSubmit={apply}
      ignoreCloseWithin={ignoreCloseWithin}
    >
      <div className="txn-filter-popover__fields">
        <label className="txn-filter-field">
          <span>Min</span>
          <input
            type="number"
            step="any"
            value={minRaw}
            onChange={(e) => setMinRaw(e.target.value)}
            placeholder={String(bounds.min)}
          />
        </label>
        <label className="txn-filter-field">
          <span>Max</span>
          <input
            type="number"
            step="any"
            value={maxRaw}
            onChange={(e) => setMaxRaw(e.target.value)}
            placeholder={String(bounds.max)}
          />
        </label>
        <p className="txn-filter-hint">
          Range: {formatAmount(bounds.min)} — {formatAmount(bounds.max)}
        </p>
      </div>
      <FilterPopoverActions onClear={clear} />
    </FilterPopover>
  )
}
